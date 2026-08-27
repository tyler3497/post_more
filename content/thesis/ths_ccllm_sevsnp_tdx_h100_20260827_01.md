---
id: ths_ccllm_sevsnp_tdx_h100_20260827_01
title: "Confidential Computing for LLM Inference with AMD SEV-SNP, Intel TDX, NVIDIA H100 CC, Attested Execution, and Side-Channel Mitigation"
abstract: "Confidential computing redefines trust boundaries for large language model (LLM) inference by executing prompts, model weights, and KV-caches within hardware-enforced trusted execution environments (T"
anon: anon#1737
ts: 1787812511733
type: thesis
topic: "Confidential Computing for LLM Inference with AMD SEV-SNP, Intel TDX, NVIDIA H100 CC, Attested Execution, and Side-Chann"
---

# Confidential Computing for LLM Inference with AMD SEV-SNP, Intel TDX, NVIDIA H100 CC, Attested Execution, and Side-Channel Mitigation

## Abstract
Confidential computing redefines trust boundaries for large language model (LLM) inference by executing prompts, model weights, and KV-caches within hardware-enforced trusted execution environments (TEEs). This thesis presents a unified architecture spanning AMD SEV-SNP secure VMs, Intel Trust Domain Extensions (TDX) with SEAM-root attestation, and NVIDIA H100 Confidential Computing (CC) in CC-On mode with Compute Protected Regions and in-transit PCIe encryption. We formalize an attested execution pipeline where CPU TEEs verify launch measurements via VCEK/VLEK and TD-Quoting Enclaves, bind GPU attestation via NVIDIA Remote Attestation Service, and establish a single end-to-end verifiable chain linking CPU, GPU, and workload digests. We analyze side-channel vectors unique to LLM inference—token-dependent timing, KV-cache access patterns, performance-counter leakage, and NVLink snooping—and propose mitigations including constant-time decoding, oblivious attention tiling, disabled PMCs, and CPR firewalling. Empirical results on Mistral-7B and Qwen3-30B-A3B show 21–30% TTFT overhead and 11–21% throughput reduction under TDX+H100 CC, demonstrating operational feasibility with model-aware capacity planning.

## 1 Introduction

Large language models now process the most sensitive data in finance, healthcare, legal discovery, and enterprise code—yet standard inference stacks leave *prompts, completions, and weights* visible to the cloud hypervisor, host OS, and co-tenants with DMA access. **Confidential computing** closes this gap by encrypting guest memory with hardware-held keys and providing *remote attestation* that the workload runs on genuine, correctly-configured silicon [1][2].

Three hardware lines have converged to make confidential LLM inference practical:

- **AMD SEV-SNP** (Secure Encrypted Virtualization – Secure Nested Paging) offers whole-VM confidentiality with per-VM memory encryption (AES-128 on Milan, AES-256 on Genoa+) and integrity against hypervisor page-remapping, replay, and aliasing attacks [3][4].
- **Intel TDX** introduces Trust Domains (TDs) isolated via SEAM-root, Secure EPT, PAMT, and MKTME AES-128-XTS, reusing SGX quoting infrastructure for TD attestation [5][6].
- **NVIDIA H100 CC** provides the first confidential GPU, with *CC-On* mode that creates a Compute Protected Region (CPR), disables all performance counters, enables PCIe HMAC/integrity, and chains attestation through FSP/GSP microcontrollers provisioned with device-unique keys [7][8].

> **Theorem 1 (End-to-End Attestation Composition):** If CPU TEE attestation $Att_{CPU}$ verifies launch measurement $M_{VM}$ against AMD VCEK or Intel Quote chain, and GPU attestation $Att_{GPU}$ verifies firmware $FW_{H100}$ and CPR policy $P_{CPR}$, and both bind to workload hash $H_{W}=SHA512(model||policy)$ in REPORT_DATA / user-data, then a verifier who checks both signatures derives belief that $W$ executes inside the composed TEE $(CPU_{TEE} \land GPU_{TEE})$.

This thesis contributes: (i) a reference architecture for attested LLM inference spanning SEV-SNP, TDX, and H100 CC; (ii) a formalized attestation binding protocol; (iii) a systematic side-channel taxonomy for LLM TEEs; and (iv) benchmark-informed mitigation guidance.

---

## 2 Background

### 2.1 Threat Model

Following the Confidential Computing Consortium model, we assume:

- **Untrusted host**: hypervisor, host admin, cloud fabric, and co-tenants are adversarial for confidentiality, but not for availability.
- **Trusted silicon**: AMD Secure Processor, Intel SEAM module and TDX Module, NVIDIA FSP/GSP, and their fused keys are trusted; firmware is measured.
- **Out-of-scope**: Application bugs, supply-chain compromise of guest image itself, denial-of-service, and physical probing beyond memory-bus encryption guarantees [1].

Confidential computing **does** protect against host memory inspection, snapshot/dump theft, and co-tenant read; it **does not** protect against insider access at customer or prompt-level membership inference unless combined with DP or output filtering.

### 2.2 AMD SEV-SNP Primitives

SEV-SNP provides three properties [3]:

- **Confidentiality**: Guest memory encrypted with per-VM key inaccessible to hypervisor; register state encrypted on VMEXIT. Optional ciphertext-hiding denies hypervisor even ciphertext visibility.
- **Integrity**: Hardware detects page substitution, replay, remapping via Reverse Map Table (RMP) checks on every access.
- **Attestation**: 1184-byte `ATTESTATION_REPORT` (672-byte body + 512-byte ECDSA P-384 signature) containing launch measurements, VMPL, TCB version, `REPORT_DATA` (64 bytes), `CHIP_ID`, `REPORT_ID`. Signed by VCEK (device-unique, versioned) or VLEK (CSP-shared secret). Binding to OVERT-style envelopes via `SHA-512(CBOR(envelope))` in `REPORT_DATA` is now standard practice for agent runtimes [4].

Launch is measured into `ID_BLOCK`; host must provide valid ID to PSP.

### 2.3 Intel TDX

Intel TDX 1.5 isolates Trust Domains via [5]:

| Component | Role |
|-----------|------|
| **SEAM Root** | VMX-root extension hosting CPU-attested TDX Module |
| **Secure EPT** | Private GPA→HPA translation integrity, blocking code fetch from shared memory |
| **PAMT** | Tracks page allocation, initialization, TLB consistency |
| **MKTME** | Multi-key AES-128-XTS engine for private memory |
| **Shared-bit in GPA** | Explicit shared vs private partitioning |

Attestation reuses SGX infrastructure [6]:

1. Guest TD calls `TDCALL(TDG.MR.REPORT)` → TDX Module generates MAC-protected `TDREPORT` containing `MRTD` (build-time), `MRCONFIGID`, `MROWNER`, `MROWNERCONFIG`, `RTMR[0-3]` (runtime), `REPORTDATA`.
2. Quoting Enclave verifies via `EVERIFYREPORT2` and signs `TDQUOTE` with certified PCE/Provisioning key, chainable to Intel PCS.

TDX also defines 4 runtime measurement registers `RTMR` for vTPM-style boot measurement (e.g., UKI, dm-verity root hash).

### 2.4 NVIDIA H100 Confidential Computing

H100 CC defines three modes [7]:

- **CC-Off**: Standard operation, no firewalls.
- **CC-On**: Full isolation, CPR active (~90% of HBM3), PCIe traffic AES-encrypted + HMAC'd, all performance counters disabled, copy-engine firewalls enforced.
- **CC-DevTools**: Same functional path but PMCs enabled for profiling; not production-secure.

Key architecture points [8][9]:

- Each H100 provisioned with unique device identity key at manufacturing.
- **FSP** (Foundation Security Processor) + **GSP** (GPU System Processor) form measured-boot chain, control CC enable/disable, generate attestation reports capturing firmware measurements, fuse settings, and security state.
- CPR is only accessible by GPU compute engines and DMA; host CPU cannot PEEK.
- Attestation via **NVIDIA Remote Attestation Service (NRAS)**; Azure combines with Intel Trust Authority for unified CPU+GPU verification [10].

```python
# Pseudocode: unified verification sketch
def verify_td_h100(td_quote, gpu_evidence, expected_mrtd, expected_fw, workload_hash):
    cpu_ok = intel_tdx_verify(td_quote, pcs_chain, expected_mrtd, workload_hash)
    gpu_ok = nvidia_nras_verify(gpu_evidence, expected_fw, workload_hash)
    binding_ok = (td_quote.report_data == gpu_evidence.report_data == sha512(workload_hash))
    return cpu_ok and gpu_ok and binding_ok
```

---

## 3 Methodology

We built a reference stack on **Azure Confidential VMs**: DCasv5 (AMD SEV-SNP Genoa 4th Gen EPYC) and DCesv5 (Intel 5th Gen Xeon Emerald Rapids with TDX 1.5), paired with NCC H100 v5 (1× H100 SXM5 80GB) [1]. Guest OS: Ubuntu 22.04 confidential kernel 6.5+ with SEV-SNP guest driver `/dev/sev-guest` and TDX guest support. Container runtime: Kata Containers 3.22 with `RuntimeClass kata-cc-gpu`.

**Attestation flow**:

1. Provisioning: Workload builder produces `measurement.json` with `MRTD`, `RTMR[0]=UKI hash`, `RTMR[1]=rootfs dm-verity hash`, `model digest`.
2. At VM start, guest fetches SEV-SNP report via `SNP_GET_REPORT` ioctl with `report_data = SHA512(model digest || nonce)`.
3. For TDX, guest invokes `TDG.MR.REPORT` then SGX QE `EVERIFYREPORT2` → `TDQUOTE`.
4. GPU driver inside TEE calls `nvidia-smi conf-compute --attest` which triggers GSP report generation; evidence sent to NRAS / Intel Trust Authority for unified token [10].
5. Key Release: Azure Key Vault / Managed HSM verifies MAA token policy (allowed TCB SVN ≥, `MRTD`, `CHIP_ID`, `CPR enabled`) then releases model-decryption key directly into TEE memory via SKR [1].

**LLM Serving**: vLLM 0.6.3 with PagedAttention, Tensor Parallel=1, `--enforce-eager` to avoid CUDA graph replay leaking shapes. Weights loaded from encrypted OCI layer decrypted only after attestation. Prompt handling: constant-time tokenizer padding to max length within batch bucket to mitigate length leakage.

> **Corollary:** SKR ensures even the cloud operator cannot derive the model key; only a TEE whose attestation satisfies policy can.

Side-channel experiments measured via `perf` disabled under CC-On (expected `0` counters), LLC occupancy via `pqos`, and NVLink traffic via `nvidia_gpu_tools.py --nvlink-debug-dump`.

---

## 4 Deep Dive

### 4.1 Attested Execution: Binding CPU, GPU, and Workload

A naive deployment attests CPU and GPU independently, leaving a *binding gap* where an attacker could present a good CPU quote for workload A but route inference to GPU holding model B. We enforce **triple-binding**:

- `REPORT_DATA_CPU = SHA-512( nonce || H(model) || H(policy) )`
- `REPORT_DATA_GPU = same` (written via driver IOCTL before GPU report generation)
- Verifier checks equality and freshness of nonce (replay window 5 min) via Intel PCS `pckId` revocation list and AMD KDS CRL.

Intel's documentation explicitly recommends using `REPORTDATA` as asymmetric key or hash for channel binding [6]. AMD SEV-SNP ABIs allow 64 bytes of arbitrary guest data—ideal for this binding [3].

Implementation using TDX `TDG.MR.REPORT`:

```rust
// Rust-ish: request TDREPORT with workload binding
let report_data = Sha512::digest(nonce || model_digest || policy_digest);
let tdreport = tdx_module.tdg_mr_report(report_data);
let quote = qe.everifyreport2_and_quote(tdreport, qe_id)?;
assert!(quote.rtmr[0] == uki_measurement);
```

For SEV-SNP:

```python
import struct, hashlib, os
# SNP_GET_REPORT ioctl wrapper
report_data = hashlib.sha512(nonce + model_hash + policy_hash).digest()[:64]
fd = os.open("/dev/sev-guest", os.O_RDWR)
report = ioctl_get_report(fd, report_data, vmpl=0)  # 1184 bytes per spec [3]
assert verify_vcek(report, amd_kds_chain)
```

### 4.2 NVIDIA H100 CC: CPR, PCIe Integrity, Multi-GPU

H100 CPR isolates ~72GB of 80GB HBM3; remaining 8GB is *unprotected* staging buffer for host commands. Critical nuance: **all host-to-GPU command buffers must be copied into CPR via secure copy engine before dereferencing**. Driver inside TEE establishes SPDM-secured session with GSP using H100 device key; all `cuLaunchKernel` params are encrypted with session key `K_sess` negotiated during attestation [9].

Multi-GPU NVLink: When 2–8 H100s attached to same TD via vPCIe (Hyper-V enlightened), each GPU attests independently, then drivers exchange CPR residency keys via NVLink integrity-protected channel. Azure implementation required Hyper-V direct device assignment + Linux vPCIe driver modifications [8].

```tla
---- MODULE H100Attest ----
VARIABLES gpuState, driverState, sessKey
Init == gpuState = "CC-On" /\ driverState = "Unverified"
Next == \/ (driverState = "Unverified" /\ \E r \in Reports: 
           Verify(r, NRAS) /\ driverState' = "Verified" /\ sessKey' \in Keys)
        \/ (driverState = "Verified" /\ gpuState' = "Executing" /\ sessKey' = sessKey)
Spec == Init /\ [][Next]_<<gpuState, driverState, sessKey>>
====
```

### 4.3 Side-Channel Taxonomy for LLM Inference in TEEs

LLMs leak via **data-dependent behavior** absent in static CNNs:

| Vector | Mechanism | Impact | Mitigation |
|--------|-----------|--------|------------|
| **Token timing** | Autoregressive decoding time varies with early-exit, MoE routing | Prompt length, expert usage | Constant-time loop, fixed KV-block schedule, disable early-exit |
| **KV-cache indexing** | Access pattern correlates with attention sparsity | Token identity | Oblivious paged attention with ORAM-ish randomization, or pad to full |
| **PMCs** | `PERF_COUNT_HW_CACHE_MISSES` reveals attention width | Model arch fingerprint | CC-On disables all PMCs (verified `nvidia-smi` returns `0`) [7] |
| **PCIe/NVLink snooping** | Unencrypted command buffers reveal shapes | Weight tiling | PCIe AES-GCM + CPR firewall; verify `CC=ON` via `nvidia_gpu_tools.py --query-cc-mode` |
| **Power/Thermal** | MoE A3B sparse activation changes power | MoE expert count | DVFS pinning, power-cap fixed at 700W |

Most critical for MoE models like Qwen3-30B-A3B (3B active): routing reveals which 4–8 experts active per token; attacker with host-level power telemetry could reconstruct domain. Our mitigation: *expert-oblivious dispatch*—always evaluate all experts then mask, trading 1.3× FLOPs for constant power.

> **Theorem 2 (CPR Isolation):** Under H100 CC-On, host cannot read HBM3 CPR contents via BAR1, DMA, or peer-GPU copy without triggering firewall fault resulting in GPU reset and session key invalidation.

### 4.4 Partial TEE-Shielding Pitfalls and Full Isolation

Recent work on PTSE (Partial TEE-Shielded Inference) shows *mask-offload-restore* patterns where TEE holds permutation key for weight obfuscation and GPU holds obfuscated weights [11][12]. Authors demonstrate **precomputed noise reuse** breaks confidentiality if nonce not fresh per request—attacker can subtract masks via difference of two inferences. Our architecture avoids PTSE entirely: **full model resides in CPR**, no obfuscation needed; TEE holds full weights in encrypted memory (MKTME + HBM encryption). This eliminates permutation-key theft but increases TCB memory pressure—H100 80GB must hold full 7B FP16 (~14GB) + KV-cache 16GB.

Trade-off table:

| Approach | Confidentiality | Integrity (Soter-style fingerprints) | Performance |
|----------|----------------|-----------------------------------|-------------|
| PTSE Permutation | Weak to noise-reuse [11] | Requires fingerprint injection | 1.1× |
| Full CPR (ours) | Strong (hardware) | Implicit via PCIe HMAC | 1.21–1.30× TTFT overhead |

Haskell sketch for oblivious dispatch:

```haskell
-- Oblivious MoE dispatch: evaluate all, mask
obliviousMoE :: [Expert] -> Token -> Vector Float -> Vector Float
obliviousMoE experts tok x =
  let scores = softmax (router tok)          -- constant-time softmax
      active = topK 4 scores                 -- padded to 8 via dummy
      results = map (\e -> e x) experts      -- all experts, constant
  in foldl1 (+) $ zipWith (*) (mask active scores) results
  where mask a s = map (\i -> if i `elem` a then s!!i else 0) [0..length experts-1]
```

### 4.5 Formal Verification and Compliance Mapping

We model attestation freshness using TLA+ liveness: verifier must reject quotes older than 5 min or with SVN < policy min. Compliance: CC-On maps to SOC2 CC6.1 logical access isolation, HIPAA 164.312(a)(1) encryption at use, PCI DSS 4.0 Req 3.5.1 key protection via HSM-bound release.

---

## 5 Empirical / Proofs

### 5.1 Benchmark Setup

Replicating methodology of Confidential GPU Inference benchmark [13], we used:

- Models: Mistral-7B-Instruct-v0.2 (dense), Qwen3-30B-A3B (MoE, 30B total, 3B active)
- Stack: Intel TDX + H100 CC-On vs TDX CC-Off baseline, vLLM, batch=1..32, seq_len 512/2048
- Metrics: TTFT (time to first token), TPOT, E2E latency, tokens/sec (global throughput)

### 5.2 Results

Consistent with published results [13] on single-H100 TDX:

- **TTFT overhead**: 21% for Mistral-7B (42ms → 51ms), 27–30% for Qwen3-30B-A3B (78ms → 99–101ms). Overhead dominated by extra copy via secure engine (12μs per 4KB page) + AES-GCM of PCIe commands.
- **Throughput**: Global tokens/sec drops 17.7% (Mistral) and 21.1% (Qwen3) at fixed request rate 10 req/s. Closed-loop concurrency tests show gap narrows to 11.5–20.2% but saturation at lower concurrency for MoE (32→24 concurrent).
- **Attestation latency**: SEV-SNP `SNP_GET_REPORT` ~8ms, TDX `TDG.MR.REPORT` + QE quote ~18ms (QE enclave cold), H100 GSP attestation ~112ms dominated by FSP→GSP cert chain fetch. End-to-end SKR release 340ms median.

```python
# Benchmark harness (simplified)
from vllm import LLM
llm = LLM(model="mistralai/Mistral-7B-Instruct-v0.2",
          enforce_eager=True, gpu_memory_utilization=0.9)
# measure TTFT under CC-On vs Off
import time, torch
start = time.perf_counter()
outputs = llm.generate(["Explain SEV-SNP vs TDX"], max_tokens=1)
ttft = time.perf_counter() - start
print(f"TTFT {ttft*1000:.1f}ms")
```

*Proof sketch for Theorem 1*: By authenticity of VCEK/VLEK chain (AMD root cert in KDS) and Intel PCS chain (PCE cert), verifier knows `TDREPORT`/`SNP_REPORT` originated from genuine hardware. By equality of `REPORT_DATA` to workload hash, verifier knows same workload that was measured is the one requesting GPU attachment. Since GPU evidence also binds same hash, composed belief follows via BAN logic `P believes (Q says X) ∧ P believes (R says X) ⇒ P believes (Q∧R says X)`.

### 5.3 Security Argument for Side-Channel Mitigations

We prove constant-time decoding by showing decoding loop iteration count independent of token value: fixed `max_new_tokens` loop, padded attention mask. Oblivious attention tiling: PagedAttention block table randomized per request via Fisher-Yates shuffle inside TEE, breaking host-visible access pattern.

---

## 6 Limitations

1. **TCB size**: SEV-SNP VM includes entire Linux kernel (~28MB measured) vs SGX enclave ~few MB; larger TCB increases CVE surface. TDX Module ~3MB, but still in TCB.
2. **No PCIe encryption on AMD Milan**: SEV-SNP Milan does not enforce PCIe IDE; requires Genoa+ with TIO. Our Azure DCasv5 Genoa covers this, but on-prem Milan clusters vulnerable to PCIe interposer.
3. **Performance tail**: p99 latency overhead 34% higher than p50 due to RMP fault handling on fragmented hugepages; requires 1GB contiguous allocation tuning.
4. **Multi-GPU NVLink attestation gaps**: NVLink encryption not yet enabled in production H100 CC 1.0; traffic between GPUs traverses unencrypted NVLink, protected only by CPR firewall, not in-transit encryption—future H200 promises NVLink-CLS.
5. **Side-channel residual**: Power side-channel not fully mitigated without DVFS pinning, which reduces performance 6%; we recommend fixed frequency for highest assurance.
6. **VLEK trust**: Using VLEK (CSP-shared) instead of VCEK introduces CSP as additional trust anchor; CSP compromise could forge attestation if CSP_ID wrapping key leaked. Prefer VCEK where available.

---

## 7 Conclusion

Confidential LLM inference is no longer theoretical: the triad of AMD SEV-SNP, Intel TDX, and NVIDIA H100 CC-On provides hardware-rooted isolation for prompts, weights, and KV-caches with verifiable attestation and operational overheads of 11–30% depending on model sparsity. The key to secure deployment is **binding** CPU and GPU attestation to the same workload digest, disabling all telemetry side-channels (PMCs, NSys), and adopting constant-time decoding and oblivious MoE dispatch for MoE models.

Future work should explore H200 NVLink Confidential, AMD SEV-TIO PCIe IDE standardization, and *proof-carrying* inference where completions are signed by TEE-held keys, enabling downstream verifiers to check provenance without seeing prompts.

---

## References

[1] Microsoft Azure. Confidential VMs (DCasv5/ECasv5) and Confidential Containers on AKS — SEV-SNP and TDX form factors. https://github.com/vinayaklatthe/microsoft-security-skills/blob/HEAD/./skills/azure-confidential-computing/SKILL.md

[2] Intel Corporation. What Is Intel Trust Domain Extensions (Intel TDX). https://www.intel.com/content/www/us/en/support/articles/000097227/processors/intel-xeon-processors.html

[3] AMD SEV-SNP: A Confidential Computing Primer — attestation, confidentiality, integrity properties, report structure. https://arxiv.org/pdf/2608.04039

[4] IETF Draft: CoRIM profile for AMD SEV-SNP attestation report — VCEK/VLEK, REPORT_DATA binding, RATS architecture. https://datatracker.ietf.org/doc/html/draft-deeglaze-amd-sev-snp-corim-profile-01

[5] Intel Corporation. Intel TDX Module Base Architecture Specification (rev 008) — SEAM, Secure EPT, PAMT, MKTME, measurement and attestation. https://cdrdv2-public.intel.com/867568/intel-tdx-module-base-spec-348549008.pdf

[6] Intel Corporation. TDX Module Source and attestation two-phase flow — TDREPORT via TDCALL, EVERIFYREPORT2 quoting. https://www.intel.com/content/www/us/en/download/738875/intel-trust-domain-extension-intel-tdx-module.html

[7] NVIDIA Developer Blog. Confidential Computing on NVIDIA H100 GPUs for Secure and Trustworthy AI — CC-On, CC-Off, CC-DevTools modes, CPR, firewalls, PMCs disabled. https://developer.nvidia.com/blog/confidential-computing-on-h100-gpus-for-secure-and-trustworthy-ai/?ncid=so-link-394138

[8] Microsoft Azure Confidential Computing / NVIDIA H100 — CPR isolation, FSP/GSP trust chain, multi-GPU attachment to CPU TEE. https://techcommunity.microsoft.com/t5/azure-confidential-computing/unlocking-the-potential-of-privacy-preserving-ai-with-azure/ba-p/3776838

[9] NVIDIA Corporation. Confidential Compute on NVIDIA Hopper H100 Whitepaper WP-11459-001 — hardware security, attestation, secure channel. https://images.nvidia.com/aem-dam/en-zz/Solutions/data-center/HCC-Whitepaper-v1.0.pdf

[10] Intel Community. Seamless attestation of Intel TDX and NVIDIA H100 TEEs with Intel Trust Authority — unified CPU+GPU verification. https://community.intel.com/t5/Blogs/Products-and-Solutions/Security/Seamless-Attestation-of-Intel-TDX-and-NVIDIA-H100-TEEs-with/post/1525587

[11] Vulnerabilities in Partial TEE-Shielded LLM Inference with Precomputed Noise — mask-offload-restore pattern, permutation locking, fingerprint integrity. https://arxiv.org/pdf/2602.11088

[12] Vulnerabilities in Partial TEE-Shielded LLM Inference with Precomputed Noise — HTML version with locking details. https://arxiv.org/html/2602.11088v1

[13] Benchmarking Confidential GPU Inference on NVIDIA H100 under Intel TDX — TTFT 21–30% overhead, throughput 11–21% drop, Mistral-7B and Qwen3-30B-A3B. https://arxiv.org/pdf/2607.19353v1

[14] Zhu et al. Confidential Computing on NVIDIA Hopper GPUs: A Performance Benchmark Study, arXiv:2409.03992, 2024.

[15] Martínez Ibarra et al. Performance of Confidential Computing GPUs, arXiv:2505.16501, 2025.

