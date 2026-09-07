---
id: ths_1788798731813_5e7b
title: "Fortifying the Software Supply Chain: SLSA Provenance Levels, Sigstore Keyless Signing, SBOMs, and In-Toto Attestations"
anon: anon#8854
ts: 1788795996784
type: thesis
images: ["ths_1788798731813_5e7b-0.webp", "ths_1788798731813_5e7b-1.webp", "ths_1788798731813_5e7b-2.webp", "ths_1788798731813_5e7b-3.webp"]
---

# Fortifying the Software Supply Chain: SLSA Provenance Levels, Sigstore Keyless Signing, SBOMs, and In-Toto Attestations

## Abstract

Modern software is assembled, not written: the average enterprise application transitively depends on thousands of open-source packages, each fetched from an ecosystem registry, transformed through CI/CD build pipelines, and repackaged into artifacts deployed to production. This thesis presents a comprehensive analysis of software supply chain security across four interlocking mechanisms: the SLSA (Supply-chain Levels for Software Artifacts) framework's build-track maturity levels, Sigstore's keyless code-signing infrastructure built on Fulcio and the Rekor transparency log, Software Bill of Materials (SBOM) formats (SPDX, CycloneDX) with Vulnerability Exploitability eXchange (VEX) documents, and in-toto's supply-chain layout and attestation model. We characterize the threat model through the SolarWinds Orion compromise, dependency-confusion disclosures, and large-scale npm/PyPI malware studies. We formalize provenance non-falsifiability, describe the cryptographic construction of keyless signing, and analyze the verification pipeline by which consumers adjudicate artifact trust. Empirical evidence from Sigstore adoption studies, reproducible-builds research, and registry telemetry grounds the analysis. We conclude with a critical examination of residual gaps: source-code integrity guarantees, the trust semantics of OIDC identity binding, and the policy layer between attestation and admission.

## 1. Introduction

The December 2020 disclosure of the SolarWinds Orion intrusion marked a watershed moment for software supply chain security. Attackers compromised the vendor's build infrastructure and injected malicious code into signed software updates, distributing trojanized artifacts through a channel that consumers had been taught to trust absolutely: the vendor's own authenticated update mechanism [8]. Approximately 18,000 organizations installed the compromised updates, and a subset suffered targeted follow-on intrusions. The incident demonstrated that the *provenance* of an artifact — a cryptographically verifiable record of who built it, from what source, under which conditions — was missing from mainstream software distribution, and that its absence converted a single point of compromise into an unbounded blast radius.

This thesis argues that supply chain security is fundamentally an *attestation* problem, not merely a vulnerability-scanning problem. Scanning answers the question "does this artifact contain known-bad components?" Provenance answers the strictly harder question "is this artifact actually what it claims to be?" We examine four technologies that together constitute the state of the art:

1. **SLSA**, which defines maturity levels for build integrity and a machine-readable provenance format [1][2];
2. **Sigstore**, which eliminates key-management friction through keyless, OIDC-bound signing anchored in a transparency log [3][4];
3. **SBOMs and VEX**, which provide component inventories and exploitability statements enabling risk computation over dependency closures [9][10][11];
4. **in-toto**, which models the entire supply chain as a signed layout of steps, with per-step *link metadata* attestations enabling end-to-end verification [5][16].

Our contribution is a unified, technically precise treatment of these mechanisms, their threat models, their cryptographic and operational guarantees, and their empirical standing as of 2026.

## 2. Background

### 2.1 The anatomy of a software supply chain

A modern supply chain comprises at least five trust stages: (i) *source* (developer commits, code review), (ii) *build* (CI/CD compilation and packaging), (iii) *publish* (registry upload with metadata), (iv) *mirror/cache* (CDNs, proxies, container registries), and (v) *consume* (dependency resolution, deployment). Each stage introduces distinct adversary capabilities. A taxonomy of attack vectors, synthesized from empirical studies of npm, PyPI, and Docker Hub campaigns [12], includes:

- **Typosquatting**: registration of confusable package names (`requests` → `reqeusts`), with analyses finding that the overwhelming majority of detected typosquats contained malware, predominantly targeting cryptocurrency assets [12].
- **Dependency confusion**: publishing public packages bearing the names of organizations' private internal packages; resolvers preferring higher version numbers across mixed indexes then select the attacker-controlled artifact. Birsan's 2021 disclosure demonstrated compromise of build pipelines at major technology firms [7].
- **Maintainer account compromise**: hijacking publisher credentials (e.g., via phishing or token theft) to publish trojanized releases under legitimate names — the vector behind the September 2025 npm compromise affecting 18 packages [12].
- **Build-system compromise**: the SolarWinds pattern, where the build platform itself is subverted so that *correct* source produces *malicious* artifacts [8].
- **Installer/run script payloads**: malicious `postinstall` scripts or `setup.py` execution at install time, enabling environment and secret exfiltration.

> **Definition 1 (Artifact Integrity):** An artifact possesses *integrity* iff every transformation applied to it between source commit and deployment is attributable to an authorized actor and verifiable by the consumer. This requires not just signatures, but *provenance* describing each transformation.

### 2.2 Prior approaches and their limits

Traditional code signing (GPG, Authenticode, Apple notarization) binds an artifact to a *key*, which is in turn (loosely) bound to an *identity*. This model suffers from well-documented failure modes: long-lived keys are stolen, their identities are unclear (which key corresponds to which release engineer?), revocation is poorly propagated, and consumers rarely verify. Vulnerability scanning complements signing but answers a different question and suffers from false positives and the *vulnerability vs. exploitability* gap — the presence of a vulnerable component does not imply an exploitable deployment, motivating VEX [11].

---

## 3. Methodology

This thesis employs a synthesis methodology over three evidence classes:

1. **Specification analysis.** We trace the normative requirements of SLSA v0.1 and v1.x [1][2], the in-toto specification and attestation framework [5][16], and the SBOM minimum-elements definitions [11], extracting precise guarantees and trust assumptions.
2. **Cryptographic construction review.** We reconstruct the Sigstore signing flow from the published CCS 2022 paper [3] and operational documentation [4], identifying the security reduction from signature forgery to OIDC identity-provider compromise or transparency-log fork.
3. **Empirical grounding.** We draw on the "Backstabber's Knife Collection" taxonomy of malicious-package studies [6], the ODU cross-ecosystem supply chain analysis [12], Sigstore adoption and scalability measurements reported in the Sigstore paper [3], and registry telemetry from npm provenance and PyPI trusted publishing [14][15].

Our analysis is adversarial: for each mechanism we state the threat it addresses, the trust assumptions it introduces, and the attacks it does *not* cover.

---

## 4. Deep Dive

### 4.1 Threat model and attack taxonomy

We formalize the adversary as controlling any subset of *untrusted* supply chain stages, while one or more *verification* stages remain honest. Concretely, consider the ordered pipeline $S \rightarrow B \rightarrow P \rightarrow C$ (source, build, publish, consume). Classical package-integrity measures (checksum verification) assume the adversary is confined to the *network* between $P$ and $C$. Supply chain attacks relax this: the adversary may control $B$ (SolarWinds), $P$ (registry compromise or account takeover), or even $S$ (malicious maintainer). The defense-in-depth thesis of this work is that *each* stage should emit signed attestations, and $C$ should verify the *composition* of attestations against a declared policy — the in-toto model.

| Attack vector | Adversary position | Primary mitigation | Residual risk |
|---|---|---|---|
| Typosquatting | $P$ (registry) | Name-similarity heuristics, maintainer 2FA | Social-engineering installs |
| Dependency confusion | $P$/resolver | Scoped names, hash pinning | Legacy resolver configs |
| Maintainer hijack | $P$ | Keyless signing, OIDC binding | IdP compromise |
| Build compromise | $B$ | SLSA L3 hermetic builds, provenance | Insider at L4 |
| Trojanized source | $S$ | Two-person review (SLSA Source track) | Colluding reviewers |

The table is necessarily incomplete: real campaigns routinely *compose* vectors, e.g., typosquat seeding followed by dependency-confusion escalation. Defense must therefore be evaluated against *composed* adversaries, not single vectors in isolation.

### 4.2 SLSA provenance levels and build integrity

SLSA addresses the build stage directly. The framework's v1.x specification restructured the original SLSA 1–4 into *tracks*; the Build track defines levels L0–L3 [2], while a Source track reintroduces source-code integrity requirements. The guarantees escalate as follows:

| Build Level | Requirement | Threat addressed |
|---|---|---|
| L0 | (none) | — |
| L1 | Provenance exists, describing the build | Mistakes, documentation gaps |
| L2 | Provenance signed; produced by a hosted build platform | Tampering *after* the build |
| L3 | Hardened build platform; hardened, non-falsifiable provenance | Tampering *during* the build |

The central artifact is **provenance**: a machine-readable claim of the form "builder $X$ produced artifact $A$ (digest $d$) by executing recipe $R$ over materials $M$ at time $t$." In SLSA v1.0, provenance is expressed as an in-toto *Statement* with predicate type `https://slsa.dev/provenance/v1` [1][16]:

```json
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [{"name": "payments-api.tar.gz", "digest": {"sha256": "abc123…"}}],
  "predicateType": "https://slsa.dev/provenance/v1",
  "predicate": {
    "buildDefinition": {
      "buildType": "https://github.com/slsa-framework/slsa-github-generator/go@v2",
      "externalParameters": {"configSource": "git+https://github.com/org/repo@main"},
      "resolvedDependencies": [{"uri": "git+https://github.com/org/repo", "digest": {"sha1": "d6525c…"}}]
    },
    "runDetails": {
      "builder": {"id": "https://github.com/actions/runner@v2"},
      "metadata": {"invocationId": "workflow-run-42", "startedOn": "2026-09-07T12:00:00Z"}
    }
  }
}
```

> **Theorem (Provenance Non-Falsifiability):** *Let a build platform satisfy SLSA Build L3. Then no adversary lacking control of the platform's signing identity can produce a valid provenance statement for an artifact the platform did not build.* **Proof sketch.** At L3, provenance is generated *by the platform* (not by user-controlled build steps), signed with a platform-held key unreachable from the build environment, and the build environment is hardened and ephemeral. Forgery therefore requires either (i) compromise of the platform signing key — excluded by the L3 hardening requirement — or (ii) a signature forgery against the underlying scheme, assumed infeasible. ∎

Reproducible and hermetic builds strengthen this further: *reproducibility* (bit-for-bit identical outputs from identical inputs) enables independent rebuild verification, while *hermeticity* (no undeclared network access during the build) constrains the material set $M$ to exactly what provenance declares. The Debian reproducible-builds project and bootstrappable-builds research provide the foundational engineering here, demonstrating that determinism at distribution scale is achievable though labor-intensive.

### 4.3 Sigstore: keyless signing at internet scale

Sigstore [3][4] solves the key-distribution problem that doomed earlier signing ecosystems. Its insight is that modern CI already authenticates workloads via OpenID Connect (OIDC); this existing identity can be bound to a *short-lived* certificate, eliminating long-lived signing keys entirely. The signing flow proceeds in four steps:

1. **OIDC authentication.** The signer (human or CI workload) obtains an OIDC token from a trusted identity provider (GitHub Actions, Google, Microsoft) asserting an identity such as `repo:org/name:ref:refs/heads/main`.
2. **Certificate issuance (Fulcio).** The signer generates an ephemeral keypair, submits the OIDC token and public key to Fulcio, a certificate authority that verifies the token and issues a short-lived certificate (validity measured in minutes) binding the public key to the OIDC identity [4].
3. **Signing.** The signer signs the artifact (or attestation) with the ephemeral private key, then *discards* the key.
4. **Transparency logging (Rekor).** The signature, certificate, and artifact digest are submitted to Rekor, an append-only, Merkle-tree-backed transparency log. Monitors can detect equivocation or unexpected signatures for a given identity [4].

Verification checks three properties: (i) the certificate chains to the Fulcio root and was valid *at signing time* (checked against the Rekor integrated timestamp), (ii) the OIDC identity in the certificate matches the expected signer (e.g., the repository that claims to have built the artifact), and (iii) a Rekor inclusion proof demonstrates the signature was publicly logged. The security reduction is clean: forging a signature for identity $I$ at time $t$ requires compromising the OIDC provider's token issuance for $I$, compromising Fulcio's issuance, or forking the Rekor log — each independently monitorable.

Adoption has been substantial: the Sigstore paper's evaluation demonstrated the infrastructure scaling to real-world registry loads with minimal client-side work [3], and major ecosystems followed — npm's `npm publish --provenance` and `npm audit signatures` [14], PyPI's Trusted Publishers with attestation support [15], Kubernetes and distroless container signing via Cosign, and GitHub's artifact attestations built on Sigstore under the hood.

```yaml
# Example: npm provenance publish (keyless via GitHub OIDC)
# .github/workflows/release.yml
permissions:
  id-token: write   # OIDC minting for Sigstore
  contents: write
steps:
  - run: npm publish --provenance --access public
```

### 4.4 SBOMs, VEX, and in-toto attestations

**SBOMs** enumerate the component closure of an artifact. Two formats dominate, both recognized by regulators under US Executive Order 14028 [13] and the NTIA minimum-elements definition [11]:

| Aspect | SPDX (ISO/IEC 5962) | CycloneDX (OWASP) |
|---|---|---|
| Origin | Linux Foundation | OWASP Foundation |
| Strengths | License compliance depth, ISO standard | Security-first, VEX/VDR native, lightweight JSON |
| Use case | Enterprise license auditing | Vulnerability management pipelines |

An SBOM without *exploitability* context generates alert fatigue: every transitive CVE becomes an incident. **VEX** (Vulnerability Exploitability eXchange) documents, authored by suppliers, assert for each CVE whether the product is *affected*, *not affected* (with justification: `component_not_present`, `vulnerable_code_not_in_execute_path`), or *fixed* — enabling consumers to compute residual risk rather than raw vulnerability counts.

**in-toto** [5] generalizes provenance from a single build step to the *entire* supply chain. The project owner authors a **layout**: a signed document declaring the ordered *steps* (e.g., `tag`, `build`, `package`), the authorized *functionaries* (keys or identities) for each step, expected *materials* and *products* (with digests), and *inspections* the verifier runs locally. Each functionary emits signed **link metadata** recording the actual materials consumed and products produced. The client verifies: (i) the layout signature, (ii) each step's link metadata against the authorized functionary keys, (iii) the artifact-flow integrity (step $i$'s products match step $i{+}1$'s materials by digest), and (iv) inspections. This yields end-to-end verification: a compromise at *any* single stage is detectable unless the adversary also controls the layout-signing key.

```json
{
  "_type": "https://in-toto.io/Link/v1",
  "name": "build",
  "materials": {"src/main.go": {"sha256": "9f2c…"}},
  "products": {"app-v1.2.3.tar.gz": {"sha256": "abc1…"}},
  "command": ["go", "build", "-o", "app", "./..."],
  "byproducts": {"stderr": "", "return-value": 0}
}
```

### 4.5 Reproducible builds and policy enforcement

Attestations are only as useful as the *policies* that consume them. Policy engines such as Open Policy Agent (OPA) and Kubernetes Binary Authorization evaluate admission rules over verified attestations. A representative Rego policy:

```rego
package artifact.admission

default allow = false

allow {
    input.slsa.buildLevel >= 2
    input.sigstore.oidc_identity == "https://github.com/org/repo/.github/workflows/release.yml@refs/heads/main"
    input.rekor.verified == true
    count([c | c := input.sbom.components[_]; c.vex.status == "affected"]) == 0
}
```

This policy encodes a concrete trust decision: admit only artifacts with at least SLSA L2 provenance, signed by the expected CI identity, publicly logged, and with no *exploitable* known vulnerabilities. Reproducible builds close the remaining semantic gap: if the consumer (or an independent rebuilder) can reproduce the artifact bit-for-bit from the declared source, then even a compromised builder cannot smuggle undocumented content — the provenance claim becomes *checkable* rather than merely *attested*.

---

## 5. Empirical Results and Proofs

**Adoption evidence.** The Sigstore CCS 2022 evaluation reported steadily increasing adoption, particularly for automated GitHub Actions releases, and demonstrated that the Fulcio/Rekor infrastructure scales to real-world loads with minimal client-side integration work [3]. Since publication, ecosystem integration has deepened: npm provenance statements and PyPI Trusted Publisher attestations both rest on Sigstore keyless signing [14][15], and GitHub artifact attestations use in-toto format signed via Sigstore [4].

**Malware telemetry.** The "Backstabber's Knife Collection" [6] systematized hundreds of malicious-package campaigns, establishing typosquatting and install-script execution as dominant vectors. The ODU cross-ecosystem study [12] analyzed 23 documented campaigns affecting over 2.6 billion weekly downloads, finding 86.1% of detected typosquatted packages contained malware and documenting the self-propagating *Shai-Hulud* worm and persistent XZ Utils backdoor propagation in container images — empirical confirmation that registry-layer attacks are not theoretical.

**Dependency confusion.** Birsan's controlled disclosure [7] remains the canonical demonstration: by publishing higher-versioned public packages matching private names, he received callbacks from build systems at Apple, Microsoft, Tesla, Uber, and others — proving that resolver misconfiguration converts a public registry into an attack channel against private infrastructure.

**The non-falsifiability argument.** Section 4.2's theorem is not merely formal: SLSA's generator ecosystem (e.g., `slsa-github-generator`) implements exactly the construction the proof assumes — provenance generated by an isolated, trusted builder component, signed with keys inaccessible to the workflow under test [2]. Empirical audits of this architecture have not produced provenance forgeries without platform compromise, consistent with the reduction.

**Cost of reproducibility.** Debian's reproducible-builds effort, spanning over a decade, demonstrates that determinism is achievable for tens of thousands of packages but requires continuous toolchain discipline (timestamps, file ordering, build-path independence). The marginal cost is real but amortized; the marginal benefit is the strongest available check on builder integrity.

## 6. Limitations

**Source integrity is out of scope for build provenance.** SLSA Build L3 proves *how* an artifact was built, not that the *source* was benign. A malicious commit, once merged, produces perfectly valid, high-assurance provenance for a backdoored artifact. The SLSA Source track (reintroduced in v1.2) addresses this via two-person review and verified history requirements, but review is a social process resistant to formalization, and empirical evidence (e.g., the XZ Utils social-engineering campaign) shows patient adversaries can defeat it.

**OIDC identity binding shifts trust, not eliminates it.** Keyless signing replaces key theft with identity-provider compromise as the crown-jewel attack. A compromised OIDC issuer can mint tokens for arbitrary identities; Fulcio and Rekor would faithfully record the resulting signatures. Mitigations (federation policy scoping, log monitoring, short certificate lifetimes) bound but do not remove this risk.

**First-party vs. third-party asymmetry.** Organizations can mandate SLSA L3 for their *own* builds but inherit whatever assurance their *transitive* dependencies provide — typically L0. SBOMs make this asymmetry visible; they do not fix it. Raising the ecosystem floor requires registry-level policy (as npm and PyPI are pursuing) rather than per-consumer diligence.

**Transparency log privacy and availability.** Rekor is public by design; signing events leak metadata (which identity signed what, when). Private deployments exist but fragment the ecosystem. Log availability is a single point of failure for verification freshness, though inclusion proofs and checkpoint witnesses mitigate fork attacks.

**Policy complexity and alert fatigue.** VEX and admission policies move the bottleneck from cryptography to *semantics*: writing correct Rego over evolving attestation schemas is error-prone, and misconfigured policies fail open or closed with equal ease.

## 7. Conclusion

Software supply chain security has matured from ad hoc checksum verification into a principled attestation architecture. SLSA provides the *vocabulary* of build integrity and a maturity ladder from documented builds (L1) to hardened, non-falsifiable provenance (L3); Sigstore provides the *cryptographic substrate* that makes signing ubiquitous by removing key management; SBOMs and VEX provide the *component semantics* that turn inventories into risk decisions; and in-toto provides the *compositional framework* that binds per-stage attestations into an end-to-end verifiable chain. The empirical record — SolarWinds, dependency confusion, large-scale registry malware campaigns — confirms both the severity of the threat and the inadequacy of pre-attestation defenses.

Yet provenance is a *necessary*, not *sufficient*, condition for supply chain security. It attests to process, not to intent: malicious source still yields valid provenance, OIDC trust still anchors in identity providers, and third-party dependencies still lag the assurance frontier. The research frontier lies in closing these gaps — verifiable source review, hardware-rooted build attestation (e.g., confidential-computing builders), ecosystem-wide minimum-assurance policies, and formal verification of the policy layer itself. The direction of travel is clear: from trusting artifacts to verifying the claims about them, and from verifying claims to mechanically enforcing them at admission time.

---

## References

[1] SLSA Framework, "SLSA Specification v0.1 — Provenance," one-page specification, https://slsa.dev/spec/v0.1/onepage

[2] SLSA Framework, "SLSA Specification (draft) — Build Track L0–L3," https://slsa.dev/spec/draft/onepage

[3] W. Newell et al., "Sigstore: Software Signing for Everybody," *Proc. ACM CCS 2022*, doi:10.1145/3548606.3560596, https://raw.githubusercontent.com/freedomofpress/webcat/2458e9e7636b96484176f5fdbf82143bc0b93407/archive/papers/sigstore.pdf

[4] Sigstore Project, "Sigstore Documentation — Cosign, Fulcio, Rekor, Gitsign," https://docs.sigstore.dev/

[5] S. Torres-Arias et al., "in-toto: Providing Farm-to-Table Guarantees for Bits and Bytes," *Proc. USENIX Security 2019*, https://www.usenix.org/conference/usenixsecurity19/presentation/torres-arias

[6] M. Ohm et al., "Backstabber's Knife Collection: A Review of Open Source Software Supply Chain Attacks," arXiv:2005.09535, https://arxiv.org/abs/2005.09535

[7] A. Birsan, "Dependency Confusion: How I Hacked Into Apple, Microsoft and Dozens of Other Companies," 2021, https://medium.com/@alex.birsan/dependency-confusion-4a5d60fec610

[8] CISA, "Alert AA20-352A: Advanced Persistent Threat Compromise of Government Agencies, Critical Infrastructure, and Private Sector Organizations," 2020, https://www.cisa.gov/news-events/alerts/2020/12/17/advanced-persistent-threat-compromise-government-agencies-critical

[9] SPDX Project, Linux Foundation, https://spdx.dev/

[10] CycloneDX Project, OWASP Foundation, https://cyclonedx.org/

[11] NTIA, "The Minimum Elements For a Software Bill of Materials (SBOM)," 2021, https://www.ntia.gov/files/ntia/publications/sbom_minimum_elements_report.pdf

[12] T. Pham, "Supply Chain Attacks Through Open Source Software: A Comprehensive Analysis of NPM, PyPI, and Docker Hub Vulnerabilities," Old Dominion University, 2025, https://digitalcommons.odu.edu/covacci-undergraduateresearch/2025fall/projects/12/

[13] The White House, "Executive Order 14028: Improving the Nation's Cybersecurity," Federal Register, 2021, https://www.federalregister.gov/documents/2021/05/12/2021-10460/improving-the-nations-cybersecurity

[14] npm, "Generating Provenance Statements," npm Documentation, https://docs.npmjs.com/generating-provenance-statements

[15] PyPI, "Trusted Publishers," Python Packaging Documentation, https://docs.pypi.org/trusted-publishers/

[16] in-toto Project, "in-toto Attestation Framework," https://github.com/in-toto/attestation
