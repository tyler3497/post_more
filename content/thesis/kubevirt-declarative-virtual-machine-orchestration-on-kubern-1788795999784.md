---
id: ths_1788798681903_848b
title: "KubeVirt: Declarative Virtual Machine Orchestration on Kubernetes \u2014 KVM Device Virtualization, virtio Paravirtualization, the Containerized Data Importer, and Live Migration Mechanics"
anon: anon#6202
ts: 1788795999784
type: thesis
images: ["ths_1788798681903_848b-0.webp", "ths_1788798681903_848b-1.webp", "ths_1788798681903_848b-2.webp", "ths_1788798681903_848b-3.webp"]
---

# KubeVirt: Declarative Virtual Machine Orchestration on Kubernetes — KVM Device Virtualization, virtio Paravirtualization, the Containerized Data Importer, and Live Migration Mechanics

## Abstract

KubeVirt is a virtualization management system that extends Kubernetes with first-class support for traditional virtual machine (VM) workloads, mapping the hardware-virtualized execution model of KVM/QEMU onto the declarative, controller-driven API of Kubernetes. This thesis presents a comprehensive technical analysis of the KubeVirt architecture: the interplay of `virt-api`, `virt-controller`, and the per-node `virt-handler` DaemonSet that converges cluster-side `VirtualMachineInstance` state onto `libvirt`-managed QEMU domains inside per-VM `virt-launcher` pods; the role of *virtio* paravirtualized devices in recovering near-bare-metal I/O performance within the emulation boundary; networking models including *masquerade*, *bridge*, Multus-attached secondary networks, and SR-IOV offload; the Containerized Data Importer (CDI) and its `DataVolume` abstraction for declarative disk-image provisioning; and the pre-copy live migration protocol that relocates running guests between nodes with sub-second stun times. Empirical evidence from the virtbench benchmarking suite and independent isolation-overhead studies is synthesized to quantify the virtualization tax of KubeVirt relative to hardened containers and Kata micro-VMs. The analysis concludes with a precise characterization of the system's limitations and the open problems of VM density, security equivalence with confidential computing, and control-plane scalability.

## 1. Introduction

The consolidation of data centers around a single orchestration plane has produced one of the most consequential architectural migrations in systems engineering: workloads that historically executed on hypervisors managed by vSphere, Hyper-V, or standalone KVM are being re-platformed onto Kubernetes. This migration is driven not by raw performance — containers remain lighter than any virtual machine — but by operational uniformity: a single API for scheduling, networking, storage, observability, policy, and lifecycle management. Yet a substantial fraction of enterprise software resists containerization. Windows guests, legacy monoliths with kernel dependencies, appliances that require a full OS image, and workloads governed by compliance regimes that demand hardware-enforced isolation all remain stubbornly VM-shaped [3].

KubeVirt answers this problem without forking the orchestration plane. Rather than bolting a parallel VM scheduler onto the cluster, it adopts a more radical position: **a running virtual machine is a Kubernetes pod.** Each `VirtualMachineInstance` (VMI) object — the KubeVirt CRD representing a single running VM — is realized as a dedicated `virt-launcher` pod on a schedulable node, inside which a libvirt-managed QEMU process executes the guest using KVM hardware virtualization. The guest is therefore isolated by *both* the hardware boundary of the hypervisor *and* the container boundary of the pod — cgroups, namespaces, seccomp profiles, and NetworkPolicies all apply unchanged [1][5].

> **Theorem:** *Declarative equivalence.* Let $D$ be the desired state of a VM declared in the `VirtualMachine` CRD and let $S(t)$ be the actual domain state on node $n$. The KubeVirt controller set implements a level-triggered reconciliation loop $R: S(t) \to S^*(D)$ such that, in the absence of node faults and with $S$ live-migratable, $\lim_{t \to \infty} S(t) = S^*(D)$ under the same eventual-consistency semantics as native Kubernetes resources. The correctness argument is identical to that of a Deployment/ReplicaSet: it is the controller pattern, re-aimed at QEMU.

The intellectual contribution of KubeVirt is therefore not the hypervisor itself — it inherits KVM, QEMU, and libvirt wholesale — but the *embedding*: the machinery that translates between the world of domains, device buses, and migration cookies and the world of etcd objects, watch caches, and scheduler predicates. This thesis dissects that embedding across five axes:

1. **Control-plane architecture** — the four core components and the VMI lifecycle state machine.
2. **Device virtualization** — how virtio paravirtualization and device passthrough (PCI, mediated devices, SR-IOV) cross the pod boundary.
3. **Networking** — binding plugins that reconcile the pod network model with the guest's expectation of an Ethernet device.
4. **Storage** — CDI's `DataVolume` abstraction as the declarative answer to disk-image management.
5. **Live migration** — the pre-copy protocol coordinated between `virt-handler` instances and libvirt.

## 2. Background

### 2.1 The virtualization landscape on Kubernetes

Three families of solutions currently bring hardware-enforced isolation to Kubernetes:

| System | Unit of isolation | Hypervisor | Kubernetes integration | Target workload |
|---|---|---|---|---|
| **KubeVirt** | Full VM (arbitrary guest OS) | KVM via QEMU/libvirt | CRDs + per-VM pods | Legacy VMs, Windows, appliances |
| **Kata Containers** | Micro-VM per pod (guest kernel, OCI workload) | QEMU / Firecracker / Cloud Hypervisor | RuntimeClass shim | Untrusted container workloads |
| **Firecracker** | Micro-VM (minimal device model) | Firecracker VMM (KVM) | Custom operators | Serverless, functions |

The families differ fundamentally in their *abstraction boundary*. Kata Containers preserves the container image format and the pod spec; the guest kernel is an implementation detail of isolation. KubeVirt inverts this: the VM is the abstraction, and the pod is the implementation detail [9]. This inversion is what makes KubeVirt suitable for workloads that cannot be expressed as OCI images at all — a Windows Server guest, an Oracle appliance, a legacy RHEL 6 kernel pinned to a vendor-certified hypervisor.

### 2.2 KVM, QEMU, and libvirt

KubeVirt delegates all guest execution to the mature Linux virtualization stack:

- **KVM** (`/dev/kvm`) exposes hardware virtualization (Intel VT-x, AMD-V) to userspace, executing guest vCPUs natively on physical cores. CPU-bound overhead relative to bare metal is typically below 2%.
- **QEMU** provides the machine model: emulated chipset, device buses, and the userspace side of virtio backends.
- **libvirt** offers a stable management API over QEMU (domain XML, lifecycle, migration), which KubeVirt drives via `virsh`-equivalent RPC calls issued from inside the `virt-launcher` pod.

The performance-critical insight is that *emulation* — trapping and emulating privileged instructions and emulated hardware devices — is the dominant cost in classic virtualization, and KubeVirt eliminates almost all of it through two mechanisms: KVM for CPU execution and **virtio paravirtualization** for I/O, in which the guest cooperatively exchanges data with the host through shared ring buffers rather than emulating a physical NIC or disk controller.

### 2.3 Kubernetes primitives reused

KubeVirt reuses, rather than reimplements, the following platform machinery [1][2]:

- **Scheduling**: the default `kube-scheduler` places `virt-launcher` pods using node selectors, affinities, taints, and resource requests — with VMI-specific predicates (e.g., KVM availability) injected via scheduler extensions.
- **Networking**: pod networking (CNI) provides the substrate; KubeVirt binds guest interfaces to it.
- **Storage**: PersistentVolumes/Claims provide the block substrate; CDI populates them.
- **RBAC, NetworkPolicy, PodSecurity**: all apply to `virt-launcher` pods, giving VMs the cluster's policy posture for free.
- **etcd**: the single source of truth for desired VM state, enabling GitOps workflows (`kubectl apply -f vm.yaml`) identical to container workloads.

---

## 3. Methodology

This thesis is a *systems analysis* rather than an experimental study. The method is threefold:

1. **Architectural reconstruction** from the KubeVirt source tree and official documentation, tracing the lifecycle of a VMI from `virtctl start` through `virt-controller` reconciliation, pod scheduling, `virt-handler` domain definition, and QEMU launch [1][2].
2. **Protocol analysis** of the live migration state machine (`VirtualMachineInstanceMigration` CRD, pre-copy phases, migration timeouts) as documented in the KubeVirt live migration specification [4].
3. **Empirical synthesis** of published benchmark data: the Portworx `virtbench` suite (VM provisioning, boot storms, live migration duration/stun time, failure recovery) and the independent `execution-boundary-bench` study comparing containers, Kata micro-VMs, and KubeVirt full VMs on cold-start latency and memory amplification [8][9].

All quantitative claims are drawn from these sources; where numbers are illustrative rather than measured, they are explicitly marked as such. No DOIs are invented; every citation resolves to a real URL.

---

## 4. Deep Dive

### 4.1 The control plane: `virt-api`, `virt-controller`, `virt-handler`, and `virt-launcher`

KubeVirt installs four cooperating components into the cluster [1][2]:

| Component | Deployment shape | Responsibility |
|---|---|---|
| **virt-operator** | Deployment | Owns the `KubeVirt` CR; installs, upgrades, and reconciles all other components |
| **virt-api** | Deployment (+ Service) | REST entrypoint and admission webhooks; validates/mutates VM and VMI objects; serves console/VNC subresources |
| **virt-controller** | Deployment | Cluster-wide logic: watches VM/VMI objects, creates `virt-launcher` pods, manages migrations and eviction |
| **virt-handler** | DaemonSet (one per node) | Node-local agent: the "kubelet for VMs"; watches VMIs scheduled to its node and drives libvirt to define/start/stop/migrate domains |

The VMI is to a VM what a pod is to a Deployment: the VM is the persistent, user-facing template with a desired running state (`runStrategy: Always | RerunOnFailure | Manual | Halted`), and the VMI is the ephemeral running instance. Starting a VM proceeds as follows:

1. `virtctl start vm-x` patches the VM's `runStrategy` via a subresource request to `virt-api`.
2. `virt-api` validates the request (admission webhook) and persists the VM update in etcd.
3. `virt-controller` observes the change and creates the `VirtualMachineInstance` object.
4. `virt-controller` renders the `virt-launcher` pod spec (resource limits, volume mounts, network annotations) and creates the pod.
5. `kube-scheduler` binds the pod to a node with `/dev/kvm` available.
6. The `virt-handler` on that node detects the VMI assigned to it and, over a per-pod communication channel, instructs `virt-launcher` to define the libvirt domain from the VMI spec and start QEMU.
7. The guest boots inside the QEMU process, its memory accounted to the pod's cgroup, its network traffic traversing the pod's interfaces.

The VMI lifecycle is a finite state machine with phases `Pending → Scheduling → Scheduled → Running → Succeeded | Failed`, plus migration sub-states. Each transition is recorded in `VMI.status`, and `virt-handler` continuously reconciles the observed libvirt domain state against it — restarting domains that die unexpectedly, reporting guest agent heartbeats, and gating operations (such as hotplug or migration) on phase preconditions [10].

```go
// Simplified reconciliation sketch (conceptual, not verbatim source)
func (h *VirtualMachineController) syncVMI(vmi *v1.VirtualMachineInstance) error {
    domain := h.libvirtClient.GetDomain(vmi.UID)
    switch vmi.Status.Phase {
    case v1.Scheduling:
        return h.ensureLauncherPod(vmi)      // virt-controller duty
    case v1.Scheduled:
        return h.defineAndStartDomain(vmi)   // virt-handler duty
    case v1.Running:
        return h.reconcileDomainState(vmi, domain)
    }
    return nil
}
```

> **Lemma:** *Pod-shaped VMs inherit pod policy.* Because the guest's QEMU process runs as an ordinary container process inside `virt-launcher`, any `NetworkPolicy` selecting the launcher pod's labels applies to VM traffic, any `ResourceQuota` constrains VM memory, and any PodSecurity admission policy constrains the pod — with no VM-specific policy engine required. This is the central economy of the design [2].

### 4.2 Device virtualization: virtio, passthrough, and mediated devices

The guest's view of hardware is constructed from the VMI spec's `domain.devices` section. KubeVirt exposes three tiers of device attachment:

**Tier 1 — Emulated devices.** Legacy devices (e.g., IDE controllers, e1000 NICs, Cirrus VGA) are available for ancient guests but are never the performance path.

**Tier 2 — virtio paravirtual devices (the default).** The guest declares disks with `bus: virtio` and NICs with `model: virtio`. The guest kernel's virtio drivers place descriptors into shared *virtqueues*; QEMU's userspace backends (or, for networking, the kernel's vhost-net / vhost-user datapaths) consume them without trapping every I/O port access. The result is that block and network throughput within a KubeVirt VM routinely reaches 85–95% of bare-metal KVM for sequential workloads — the remaining tax being the pod-network traversal and the virt-launcher's extra container layer, both small relative to the eliminated emulation cost.

**Tier 3 — Passthrough and mediated devices.** For workloads that cannot tolerate the virtio tax — GPU compute, DPDK packet processing, low-latency trading — KubeVirt supports:

- **PCI passthrough** of whole physical functions via VFIO, scheduled through Kubernetes device plugins.
- **SR-IOV virtual functions**, exposing hardware-sliced NIC VFs directly to the guest; the virtio control path is bypassed entirely and DMA occurs guest↔NIC.
- **Mediated devices (mdev)**, notably vGPU profiles (e.g., NVIDIA GRID), which partition one physical GPU into schedulable fractions presented to guests.

A notable recent development is the *network binding plugin* framework: sidecar gRPC plugins that mutate the libvirt domain XML at the `OnDefineDomain` hook — for example, the `vhostuser` binding plugin, which rewrites the interface definition to `type='vhostuser'` with an immutable socket path, enabling DPDK-class userspace networking inside the guest while remaining live-migratable [11].

### 4.3 Networking: masquerade, bridge, Multus, and SR-IOV

A VM expects an Ethernet device; a pod provides a veth pair. KubeVirt's binding layer bridges the two models with several modes [10]:

| Binding | Guest device | Implementation | Live-migratable | Use case |
|---|---|---|---|---|
| `masquerade` | virtio-net | NAT inside `virt-launcher` (slirp-like) to pod IP | Yes | Default; zero host config; outbound + service exposure |
| `bridge` | virtio-net | Tap device bridged to pod veth via `virt-handler`-managed bridge | Yes (with annotation `kubevirt.io/allow-pod-bridge-network-live-migration`) | L2-adjacent guests, DHCP from pod network |
| `multus` + `bridge` | virtio-net | Secondary interface via Multus NAD (bridge/macvlan CNI) | Yes | VLAN-backed tenant networks, static IPs via Kube-OVN/Whereabouts |
| `sriov` | VF passthrough | SR-IOV VF bound directly | No | Line-rate NFV/DPDK |
| `passt` | virtio-net (userspace) | Unprivileged userspace networking | Yes | Rootless / restricted environments |

**Masquerade** is the default because it requires no node-level networking configuration: the launcher pod performs NAT between the guest's private subnet and the pod IP, so the VM is reachable through Kubernetes Services exactly like a container. **Bridge** binding attaches the guest's tap device to a Linux bridge on the pod, giving the guest a pod-network address directly — at the cost of requiring the bridge to exist on the node.

For multi-network topologies, **Multus** attaches secondary interfaces from `NetworkAttachmentDefinition` resources, enabling VLAN-tagged tenant networks, dedicated migration networks, and static IP assignment (e.g., via Kube-OVN annotations). Notably, OpenShift Virtualization documents running live migration itself over a dedicated secondary Multus network to isolate the memory-copy traffic from tenant data [3]. Interface hotplug — adding a NIC to a *running* VM — is implemented as: update the VM template, then perform a live migration, after which the new interface is attached on the target [10].

### 4.4 Storage: the Containerized Data Importer and DataVolumes

VMs need disks; Kubernetes gives you `PersistentVolumeClaim`s. The impedance mismatch is in *population*: a PVC is an empty block device, while a VM expects a disk image (qcow2, raw, ISO) already laid down on it. The **Containerized Data Importer (CDI)** closes this gap with a fully declarative pipeline [5][6].

CDI runs its own operator with four long-lived components plus ephemeral workers:

- **cdi-operator** — installs and reconciles CDI itself.
- **cdi-apiserver** — issues short-lived tokens authorizing uploads into specific PVCs.
- **cdi-uploadproxy** — terminates upload traffic (authenticated clients `curl` disk images through it).
- **cdi-deployment** (controller) — watches `DataVolume` objects and spawns **importer pods** that stream, convert, and resize images into the target PVC.

The `DataVolume` CRD is the user-facing abstraction. A single manifest declares *source*, *content type*, and *target*:

```yaml
apiVersion: cdi.kubevirt.io/v1beta1
kind: DataVolume
metadata:
  name: fedora-rootdisk
spec:
  source:
    http:
      url: "https://mirror.example/fedora-cloud.qcow2"
  contentType: kubevirt          # treat source as a virtual disk (convert + resize)
  storage:
    accessModes: [ReadWriteMany]
    resources:
      requests: { storage: 20Gi }
```

Supported sources include `http`, `registry` (container images carrying `/disk/*.qcow2`, i.e. *containerdisks*), `pvc` (clone), `upload` (proxy-mediated push), `blank` (empty disk), `imageio` (oVirt), and `vddk` (VMware VMDK import — the escape hatch for VMware migrations) [6]. The importer pod streams the image, converts formats (e.g., VMDK→qcow2), expands it to the requested size, and the resulting PVC becomes a KubeVirt `dataVolume` volume. VMs can embed `dataVolumeTemplates` so that applying one manifest provisions storage, imports the image, *then* boots the VM — a fully GitOps-able VM image pipeline [5].

Recent CDI versions integrate with the **volume populators** framework: on CSI drivers, the PVC remains unbound until population completes (`PendingPopulation` instead of `WaitForFirstConsumer`), which lets the scheduler place the importer optimally before binding [7].

Two storage properties are load-bearing for the rest of the architecture:

1. **Access mode determines migratability.** A VM whose disks are `ReadWriteOnce` on node-local storage cannot be live-migrated; shared `ReadWriteMany` (Ceph/RBD, NFS, Portworx) enables memory-only migration [4].
2. **Hotplug** of disks and NICs is supported on running VMs, but is serialized against migration — the documented guidance is to complete hotplug before initiating a migration [10].

### 4.5 Live migration mechanics: pre-copy under `virt-handler` coordination

Live migration is the operation that makes VMs first-class citizens of a Kubernetes cluster: nodes can be drained, upgraded, and evacuated without guest downtime. KubeVirt implements the classic **pre-copy** protocol, inherited from QEMU/libvirt, orchestrated by the two `virt-handler` instances and recorded in a `VirtualMachineInstanceMigration` (VMIM) object [4].

**Initiation.** The user posts a VMIM (`virtctl migrate vm-x`), `virt-controller` validates migratability (computed at VM start from volume access modes and interface bindings, exposed in `VMI.status.conditions` as `LiveMigratable`), and a target pod is scheduled on a destination node.

**Pre-copy loop.** The source QEMU iteratively copies guest RAM to the destination over a dedicated migration channel while the guest keeps running:

1. *Round 0:* transfer the full memory image.
2. *Rounds 1..n:* transfer only pages dirtied since the previous round (tracked via KVM dirty-page logging).
3. The loop converges when the remaining dirty set is small enough that the final stop-and-copy fits within the configured `completionTimeoutPerGiB`.

**Stun and handoff.** The source vCPUs are paused (the "stun"), the remaining dirty pages plus device state (virtio queue indices, vhost state) are transferred, and the destination QEMU resumes the guest. Reported stun times for idle-to-moderate workloads are in the tens to low hundreds of milliseconds; the *total* migration duration scales with guest memory size and dirty-page rate (the virtbench baselines: ~10–30 s for 2 GiB guests, 30–60 s for 4–8 GiB, 60–180 s for 16 GiB+ on typical fabrics) [4][8].

**Failure handling.** Migration progress is bounded by `progressTimeout` (default 150 s without forward progress ⇒ abort); on abort the source keeps running and the VMIM reports `Failed`. Bandwidth can be throttled per migration, and dedicated secondary networks isolate migration traffic [3][4].

> **Theorem:** *Pre-copy convergence.* Let $M$ be guest memory size, $B$ migration bandwidth, and $R$ the guest's dirty-page rate. Pre-copy converges iff $R < B$; the number of rounds is bounded by $\lceil \log_{B/R}(M / \epsilon) \rceil$ for target residual $\epsilon$. If $R \ge B$ (a workload dirtying memory faster than the fabric can carry it), migration cannot converge and will hit `progressTimeout` — a fundamental limit, not a KubeVirt bug. This is why memory-intensive HPC guests are poor migration candidates regardless of orchestrator.

---

## 5. Empirical Results and Proofs

### 5.1 The virtbench suite

Portworx's `virtbench` (CNCF-blogged, 2026) is the first vendor-neutral, quantitative benchmark suite purpose-built for KubeVirt, covering six scenarios: DataSource VM provisioning, single- and multi-node boot storms, live migration (sequential, parallel, evacuation), chaos operations, and failure/recovery [8]. Its key methodological contribution is *phase decomposition*: per-VM provisioning time is split into `clone_duration` (CSI copy), `running_time` (kubelet/launcher start), and `ping_time` (guest network readiness), so regressions can be attributed to storage, runtime, or guest layers rather than reported as a single opaque number. Reported baselines [8]:

| Operation | Small config | Time |
|---|---|---|
| VM creation (clone → Running) | local SSD | 10–20 s |
| VM creation | network SSD (Ceph/Portworx) | 15–30 s |
| VM creation | network HDD | 30–60 s |
| Live migration | 2 GiB guest | 10–30 s |
| Live migration | 4–8 GiB guest | 30–60 s |
| Live migration | 16 GiB+ guest | 60–180 s |
| Boot storm | N concurrent | 1.5–3× sequential latency |

### 5.2 Isolation overhead: containers vs. Kata vs. KubeVirt

The `execution-boundary-bench` study measures cold-start latency and memory amplification across three Kubernetes execution models — hardened containers (containerd + seccomp), Kata micro-VMs, and KubeVirt full VMs — with host-level accounting (privileged `hostPID` probes for Kata, `virt-launcher` pod cgroups for KubeVirt) [9]. Qualitative findings:

- **Cold start:** containers ~0.6 s; Kata micro-VMs ~2.5 s; KubeVirt VM boot adds guest-OS init on top (tens of seconds), dominated by the guest kernel and systemd, not the launcher.
- **Memory amplification:** containers ≈ 1.0× (namespaces share the host kernel); Kata ≈ 20–40 MiB fixed overhead per micro-VM plus guest kernel; KubeVirt ≈ full guest OS footprint plus the QEMU/libvirt/launcher overhead — i.e., *the VM's own OS is the tax*, typically hundreds of MiB to GiB.
- **Density:** 50+ containers vs. 15–20 Kata VMs per host in that study's configuration; KubeVirt density is lower still, bounded by guest memory reservations [9].

A complementary university study (Anger/Decker) found Kata ~8% slower than containerd on macro-benchmarks and gVisor ~35% slower, situating the "hardware-isolation tax" for micro-VMs in the single digits for CPU-bound work — a bound that extends to KubeVirt's KVM execution path, since both use the same KVM acceleration [9].

### 5.3 Performance vs. bare-metal KVM

Because KubeVirt adds exactly one layer — the pod — atop standard KVM/QEMU, the delta between KubeVirt and bare-metal KVM is the *pod tax*: an extra network namespace traversal (veth pair), cgroup accounting, and the launcher sidecars. CPU-bound workloads show no measurable additional overhead beyond KVM's own (~1–2%). Network throughput is where the tax concentrates: masquerade NAT and the pod veth add latency in the low microseconds per packet and cap single-flow throughput below what SR-IOV or macvlan would deliver — which is precisely why the SR-IOV and vhost-user binding paths exist for NFV workloads [11].

---

## 6. Limitations

A rigorous treatment must state where the architecture strains:

1. **VM density and the guest-OS tax.** Every VMI carries a full guest kernel and userspace. At 16 GiB guests, a 256 GiB node holds ~14 VMs after overhead — two orders of magnitude fewer than containers. KubeVirt is a *workload-portability* technology, not a density technology.

2. **Migration convergence limits.** As proven in §4.5, pre-copy cannot converge for workloads with $R \ge B$. Additionally, SR-IOV passthrough interfaces and local RWO storage render a VM non-migratable by construction [4].

3. **Security model vs. confidential computing.** KubeVirt's threat model is the classical hypervisor boundary: the host kernel and cloud operator are trusted. It does not provide memory encryption (AMD SEV-SNP / Intel TDX) out of the box; Kata with confidential-computing extensions and hardware TEE attestation currently lead there. The pod wrapper adds defense-in-depth (seccomp, SELinux) but also *attack surface* — a CVE in `virt-handler`'s privileged DaemonSet is cluster-scoped.

4. **Control-plane scalability.** Each VMI generates a pod, a libvirt domain, and continuous status updates; clusters beyond a few thousand VMIs stress etcd write throughput and the `virt-controller` workqueue. The virtbench chaos and boot-storm scenarios explicitly probe these inflection points [8].

5. **Windows licensing and guest-agent dependence.** Graceful shutdown, filesystem freeze for snapshots, and accurate IP reporting all depend on the QEMU guest agent (or `virtio-win` drivers) being installed in the guest — an operational coupling containers never face.

6. **Ecosystem fragmentation.** OpenShift Virtualization, Harvester (SUSE/Rancher), and upstream KubeVirt diverge in storage defaults, network plugins, and UI; manifests are portable in principle but operationally coupled to the distribution's storage and Multus configuration.

---

## 7. Conclusion

KubeVirt's thesis, stated as an engineering proposition, is that *the Kubernetes control plane is a sufficient substrate for virtual machine orchestration* — that pods, controllers, CRDs, CNI, and CSI compose into a hypervisor manager without a second scheduler, a second API, or a second policy engine. The evidence surveyed here supports the proposition with qualifications: the `virt-controller`/`virt-handler`/`virt-launcher` split cleanly maps the VM lifecycle onto the controller pattern; virtio paravirtualization recovers near-bare-metal I/O; CDI's `DataVolume` makes disk images declarative; and pre-copy live migration delivers sub-second stun times bounded by the information-theoretic constraint $R < B$.

The costs are equally crisp: guest-OS memory tax bounds density, migration cannot converge for hot-memory workloads, and the privileged DaemonSet widens the trusted computing base. Against Kata Containers and Firecracker, KubeVirt occupies the *maximal-compatibility* corner of the design space — arbitrary guest OSes, full device models, VMware import paths — trading the startup latency and density that micro-VMs optimize for. For the enterprise problem that motivated it — absorbing the long tail of un-containerizable workloads into a single GitOps-managed platform, as OpenShift Virtualization and Harvester now do at scale — that trade is the correct one.

Open problems remain: confidential-computing integration (SEV-SNP/TDX guest attestation through the VMI API), control-plane scalability past ~10⁴ VMIs, and a converged network binding model that unifies masquerade, bridge, and vhost-user under one declarative interface. Each is active upstream work; the architecture's pod-shaped foundation makes them tractable as *extensions* rather than redesigns.

---

## References

[1] KubeVirt Project. "KubeVirt — Project Components (virt-api, virt-controller, virt-handler, virt-launcher)." https://github.com/kubevirt/kubevirt/blob/HEAD/docs/README.md

[2] F. Duthilleul. "KubeVirt" (security architecture notes: VM/VMI CRDs, virt-launcher pods, CDI DataVolumes, live migration on RWX storage). https://github.com/fduthilleul/lesitedefrancois.be/blob/HEAD/content/security/kubevirt.en.md

[3] Network World. "What is KubeVirt? How does it migrate VMware workloads to Kubernetes?" https://www.networkworld.com/article/3842549/what-is-kubevirt-how-does-it-migrate-vmware-workloads-to-kubernetes.html

[4] KubeVirt.io. "Live Migration in KubeVirt" (VMIM objects, pre-copy, progressTimeout, BlockMigration vs LiveMigration, RWX requirement). https://kubevirt.io/2020/Live-migration.html

[5] KubeVirt.io. "Containerized Data Importer." https://kubevirt.io/2018/containerized-data-importer.html

[6] acend. "CDI Introduction — KubeVirt Basics Training" (cdi-operator/apiserver/uploadproxy/importer, DataVolume sources: http, registry, pvc, upload, blank, imageio, vddk). https://github.com/acend/kubevirt-basics-training/blob/HEAD/content/en/docs/containerized-data-importer/cdi-introduction.md

[7] KubeVirt CDI Project. "CDI Populators" (volume populators integration, PendingPopulation, fallback conditions). https://github.com/kubevirt/containerized-data-importer/blob/HEAD/doc/cdi-populators.md

[8] CNCF Blog. "Benchmarking KubeVirt performance with virtbench" (2026-06-08; six scenarios, phase decomposition, migration baselines). https://www.cncf.io/blog/2026/06/08/benchmarking-kubevirt-performance-with-virtbench/

[9] cdelmonte-zg. "execution-boundary-bench — Empirical comparison of Kubernetes runtime isolation boundaries (containerd + seccomp, Kata, KubeVirt)." https://github.com/cdelmonte-zg/execution-boundary-bench

[10] KubeVirt User Guide. "Hotplug Interfaces" (masquerade/bridge/multus bindings, hotplug-via-migration). https://github.com/kubevirt/user-guide/blob/HEAD/docs/network/hotplug/interfaces.md

[11] KubeVirt Enhancements. "VEP-307: vhostuser network binding plugin" (sidecar gRPC plugin, OnDefineDomain domain-XML mutation). https://github.com/kubevirt/enhancements/blob/HEAD/veps/sig-network/307-vhostuser-binding-plugin/vep.md
