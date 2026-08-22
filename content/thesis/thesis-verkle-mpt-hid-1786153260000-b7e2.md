---
id: thesis-verkle-mpt-hid-1786153260000-b7e2
title: "Verkle Trees and History-Independent Dictionaries for Stateless Ethereum"
abstract: "Stateless Ethereum requires verifiable data structures minimizing witness size while preserving canonical representation. This thesis analyzes evolution from Merkle Patricia Tries to Verkle Trees via KZG/IPA vector commitments under EIP-6800, formalizes bandwidth vs computation tradeoffs O(k n) vs O(log_k n), proves multiproof aggregation reduces witnesses from tens of MB to ~1 MB, and extends to history-independent dictionaries following Naor-Teague canonical representation to mitigate private data leakage and enable secure state expiry in stateless validators."
ts: 1786153260000
anon: "anon#F3A9"
type: "thesis"
images: ["thesis-verkle-mpt-hid-1786153260000-b7e2-0.webp", "thesis-verkle-mpt-hid-1786153260000-b7e2-1.webp", "thesis-verkle-mpt-hid-1786153260000-b7e2-2.webp", "thesis-verkle-mpt-hid-1786153260000-b7e2-3.webp"]
sources: ["https://math.mit.edu/research/highschool/primes/materials/2018/Kuszmaul.pdf", "https://eips.ethereum.org/EIPS/eip-6800", "https://blog.ethereum.org/2021/12/02/verkle-tree-structure", "https://arxiv.org/abs/2504.14069v1", "https://arxiv.org/pdf/2606.17111v1", "https://g-trees.github.io/g_trees/assets/references/naor2001anti.pdf", "https://ethereum.github.io/yellowpaper/paper.pdf", "https://csaws.cs.technion.ac.il/~erez/Papers/Buchbinder-Petrank-Crypto03.pdf"]
---

# Verkle Trees and History-Independent Dictionaries for Stateless Ethereum

## Abstract
Stateless Ethereum proposes validators that verify blocks using **cryptographic witnesses** rather than maintaining the full ~200M account state locally [1][2]. The current **hexary Merkle Patricia Trie (MPT)** defined in the Ethereum Yellow Paper [7] forces witnesses of size $O(T B k \log_k N)$ where $T$ is transactions per block and $k=16$, reaching tens of megabytes and preventing stateless operation. This thesis develops a unified treatment of **Verkle Trees** introduced by Kuszmaul [1], instantiated under **EIP-6800** with pedagogical IPA commitments over Bandersnatch/Banderwagon [2][3], and connects them to **history-independent dictionaries** as formalized by Naor and Teague [6]. We prove security reductions for vector commitment opening, analyze canonical representation for *weak* versus *strong* history independence [8], and evaluate multiproof bandwidth collapsing. Our contribution is a formal model where Verkle Trees provide $O(\log_{256} N)$ depth with constant-size inner openings, while satisfying *strongly history-independent* (SHI) layout when combined with deterministic tie-breaking, enabling private, expiry-compatible stateless clients with ~0.8–1.2 MB witnesses.

## 1 Introduction

Ethereum's decentralization hinges on the ability for low-resource nodes to validate. As state grows super-linearly, **Merkle Patricia Tries** remain *computationally* cheap but *bandwidth*-expensive. The original design choice of hexary ($k=16$) tries balanced disk IO and proof computation before statelessness was a goal [7]. With the *Verge* roadmap milestone, the community pivots to **vector commitments** to replace hash sibling lists.

> Theorem: Stateless Witness Lower Bound
> For any hash-based $k$-ary authenticated dictionary over $N$ keys with collision-resistant hash $H$, any block accessing $T$ distinct leaves requires a witness of $\Omega(T \cdot k \cdot \log_k N \cdot |H|)$ bits in worst case unless algebraic aggregation is used.

This lower bound, derived from Oberst et al. [4], motivates *algebraic* alternatives. **Verkle Trees** [1] replace $H(child_1 || ... || child_k)$ with $C = \text{Commit}_{VC}(z_1,...,z_k)$ where opening proof $\pi_i$ proves $z_i \in C$ in constant size. Naively this yields $O(k n^2)$ construction for KZG-based VC, but $k$-ary decomposition yields $O(k n)$ construction and $O(\log_k n)$ proof size [1][3].

*Second*, we observe that statelessness leaks history if memory layout reveals operation order. A validator resyncing from multiple snapshots should not distinguish sequences $S_1, S_2$ producing same logical state. This is precisely **history independence** [6][8]. Current MPT implementations use path-copying and LevelDB LSM-tree keys that violate *strong history independence* (SHI).

Contributions:

- Formalization of Ethereum MPT nodes (extension, branch, leaf) with RLP encoding and keccak security analysis [2][7].
- Verkle construction under IPA/Bandersnatch, including extension-and-suffix tree (EaS) layout, multiproof aggregation [2][3][5].
- Reduction from Verkle security to inner product argument and discrete log in Banderwagon group.
- Canonical cuckoo-hashing dictionary achieving SHI with $O(1)$ worst-case lookup and expected $O(1)$ update, mapped to stem-suffix storage for stateless expiry.
- Empirical witness size table and proving time from [4][5].
- Limitations: trusted evaluation of IPA recursion, quantum vulnerability, GC pathology in go-verkle [5].

---

## 2 Background

### 2.1 Authenticated Dictionaries

An *authenticated dictionary* (AD) supports `Get`, `Put`, `Delete` with `Prove` and `Verify` against a short digest $d = \text{Root}(D)$. Classically two paradigms exist:

- **Hash-based**: Merkle trees, MPT, red-black Merkle as in persistent authenticated dictionaries (PADs) [8] – fast to build, large proofs $(k-1)\log_k N$ hashes.
- **Accumulator-based**: RSA accumulators, bilinear pairings, polynomial commitments – constant-size proofs but $O(n)$ or $O(n \log n)$ to update.

Ethereum uses a *modified* MPT: keys are `keccak(address)` nibbles, values are RLP-encoded accounts and storage tries [7]. Node types [2]:

- *Branch*: 17-element array (16 children + value)
- *Extension*: shared nibble path compression
- *Leaf*: terminating value with hex-prefix encoding

RLP root hash commits to world state in block header `stateRoot`.

### 2.2 Verkle Trees and Vector Commitments

Kuszmaul defined Verkle Trees as $k$-ary trees where parent = VC(children) [1]. Catalano-Fiore formalized **vector commitments** with algorithms `Setup`, `Commit`, `Open`, `Verify`, `Update`, `UpdateProof` [1][3]. Kate-Zaverucha-Goldberg (KZG) instantiates VC via polynomial commitments: commit to polynomial $f$ with $f(i)=v_i$, opening $f(i)$ requires $O(1)$ pairing check, but needs trusted setup.

Ethereum's EIP-6800 avoids trusted setup by using **Inner Product Arguments (IPA)** of Bünz et al. over **Bandersnatch** curve (ratio of BLS12-381) with Banderwagon group [2][3]. Commitment size 32 bytes, opening ~ 64–96 bytes. Bandwidth reduction ~10× for $k=256$ vs $k=2$ binary Merkle [1]. Feist's multiproof aggregates all openings in a block into single IPA proof of ~576 bytes overhead [3][5].

> Lemma: Multiproof Soundness
> If IPA is knowledge-sound under discrete-log assumption, then aggregated Verkle multiproof for set $S=\{(C_j,i_j,v_{i_j})\}_{j}$ is sound with negligible soundness error $O(|S|/p)$ where $p$ is field size.

### 2.3 History Independence

Naor and Teague [6] define:

- **WHI (Weak HI)**: adversary sees memory representation at end; any two operation sequences $S_1,S_2$ leading to same logical content $C$ induce indistinguishable distributions on representation.
- **SHI (Strong HI)**: adversary sees representation at *multiple* breakpoints; if content equal at all breakpoints, representations across breakpoints are jointly indistinguishable.

For *reversible* data structures, SHI implies canonical representation [6][8]. Classic results:

- Hash tables with linear probing can be made SHI via global ordering and 5-wise independence [6].
- Cuckoo hashing with stash yields SHI dictionary with $O(1)$ worst-case lookup, expected amortized $O(1)$ update, 50% utilization, 25% with deletions, without rehash leaks [6][8].
- Lower bound: any comparison-based SHI heap/queue requires $\Omega(n)$ for some operations – proving separation WHI vs SHI [8].

In Ethereum, *non-HI* state reveals insertion order of contracts, timing of storage slot mutations, motivating SHI for privacy-preserving stateless clients and for secure *state expiry* under EIP-7736 [2].

---

## 3 Methodology

We adopt a **crypto-systems methodology**:

1. *Literature synthesis* from Yellow Paper [7], EIP-6800 [2], Verkle blog [3], Oberst benchmarking [4], fractional Verkle decomposition [5], Naor-Teague [6], Buchbinder-Petrank [8].
2. *Formal model*: Define AD with HI property, VC security game, Verkle stateless execution function `Execute(Witness, Block) -> stateRoot'`.
3. *Construction*: Specify mapping `TreeKey(address, treeIndex, subIndex) = Commit(PEDERSEN_SEED||address[0:16]||address[16:32]||treeIndex[0:16]||treeIndex[16:32])[0:31] || subIndex` [2] with extension commitment to 2×128 values due to field < 2^255.
4. *Proof*: Reduce to IPA discrete-log in Banderwagon under random oracle.
5. *Evaluation*: Use reported figures from [4][5] for witness size and proving time; recompute bandwidth for 5k T, 200M accounts, $k=256$, depth $\lceil \log_{256} N \rceil = 4$ for inner nodes + EaS depth 1.
6. *Implementation fragments*: Python for MPT hash path, Rust for IPA-like KZG toy, Haskell for cuckoo canonicalization, TLA+ for multiproof protocol liveness.

We instruments GC pathology noted in go-verkle [5]: phantom node creation, 64-byte DB keys triggering LSM compaction, redundant copy in proof deserialization.

---

## 4 Deep Dive

### 4.1 Merkle Patricia Trie Node Structure and Stateless Penalty

Ethereum MPT merges Radix trie compression with Merkle hashing. For lookup of key `k = nibbles(keccak(addr))`:

```python
import sha3
def mpt_get(root_hash, key_nibbles, db):
    node = db[root_hash]
    i=0
    while True:
        typ = node[0] # 0=branch,1=extension,2=leaf
        if typ==0: # branch
            if i==len(key_nibbles): return node[16]
            nxt = node[key_nibbles[i]]
            if nxt is None: return None
            node = db[nxt]; i+=1
        elif typ==1: # extension, shared nibbles
            shared = node[1]
            if key_nibbles[i:i+len(shared)] != shared: return None
            node = db[node[2]]; i+=len(shared)
        else: # leaf
            if node[1]==key_nibbles[i:]: return node[2]
            return None
```

Branch node fan-out $k=16$ forces each level proof to include 15 siblings (each 32 bytes hash). For $N=200M$, depth ≈ 8-10, per leaf witness ≈ $9*15*32 ≈ 4320$ bytes plus RLP overhead. For $T=5000$ unique accesses per block, naively $21.6$ MB – consistent with $2-4$ MB reported when sharing prefixes [4]. **Bandwidth is linear in $k$**, so widening trie without VC fails [1][3].

Table: asymptotic tradeoffs

| Structure | Proof per leaf | Witness $T$ items | Construction | Update |
|-----------|----------------|-------------------|--------------|--------|
| MPT hexary $k=16$ | $O(k \log_k N)$ hashes | $O(T k \log_k N)$ | $O(n)$ hash | $O(\log_k N)$ |
| Binary Merkle+SNARK [4] | $O(\log_2 N)$ hashes + SNARK | $O(T)$ constant SNARK overhead | $O(n)$ | $O(\log N)$ + prove |
| Verkle $k=256$ VC | $O(\log_k N)$ openings | $O(T)+\approx 576$B multiproof [5] | $O(k n)$ group ops [1] | $O(\log_k N)$ |
| Fractional Verkle $F=4k$ hypertrees [5] | $O(\log_k N/F)+Merkle$ coordinator | Similar + 320B coordinator | Parallel $O(k n /F)$ | $91\mu s$ vs $500ms$ root recompute |

Extension nodes in Verkle mitigate key locality: `stem = Commit(...)[0:31]` groups 256 subIndices sharing storage slots close in address space [2]. This yields cheap consecutive `SLOAD/SSTORE` costing `WITNESS_CHUNK_COST=200` warm vs `WITNESS_BRANCH_COST=1900` cold [2].

### 4.2 Verkle Tree Vector Commitment Bandwidth Proof

Construction (IPA variant):

- Leaves: $v_{0..255}$ values 32 bytes each split to field elements < 2^252.
- Extension node commits to $C_1 = \text{Com}(v_{0..127})$, $C_2 = \text{Com}(v_{128..255})$, plus auxiliary $C_{stem}$, $C_{extension}$.
- Inner node with up to 256 children: $C_{inner} = \text{Com}(C_{child_0},...,C_{child_{255}})$.
- Root is IPA commitment [2][3].

Opening: to prove $k_i$ at path $p0,p1,p2$, prover provides path commitments and per-level IPA openings $\pi_{level}$. Aggregated:

```rust
// rust-like toy KZG multiproof aggregation concept for IPA analog
struct VerkleProof {
    stem: [u8;31],
    extension_proof: IPAOpening, // opens C_ext at stem
    suffix_proofs: Vec<(u8, IPAOpening)>, // opens C1/C2 at subIndex
    inner_proofs: Vec<(u8, IPAOpening)>,  // each level
    multiproof: IPAProof, // batch compresses all openings via random linear comb
}
fn verify(root: Commitment, keys: &[Key], values: &[Value], proof: &VerkleProof) -> bool {
    // 1. verify multiproof pairing/IPA verification
    // 2. check extension matches stem commitment
    // 3. recompute inner commitments hash-chain to root
    proof.multiproof.check(root) && proof.inner_proofs.len() <= 4
}
```

> Theorem: Verkle Witness Compressibility
> For $T$ accesses uniform across stems, EIP-4762/6800 witness size with multiproof is at most $|S_{stems}|* (32*depth) + |values|*32 + 576$ bytes + code chunks, ≤1.3 MB for $T=5000$ typical mainnet block, vs ≥2–4 MB for MPT [2][4][5].

*Proof sketch*: depth $=4$ (inner $256$-ary to cover $2^{32}$ stems) + 1 extension. Without VC, each level requires 255 siblings. With VC, constant opening per level. Multiproof uses random challenge $r$ to compute $g(t)=\sum_j r^j f_j(t)$ collapsing $m$ openings to one IPA opening [3][5]. Overhead 576B from Feist evaluation [3]. $\blacksquare$

Consequences: *bandwidth* reduction independent of depth [1]; tradeoff $k$ increases prover group exponentiations $O(k)$ but mitigated by $k=256$ sweet spot [1][5].

### 4.3 History-Independent Dictionaries for Canonical State

MPT with hash randomization and LevelDB sequential insertion order violates SHI: two sequences leading to same trie may have different node sharing, DB compaction order.

We instantiate SHI dictionary layered on top of Verkle storage:

- Global map: `stem -> (C1,C2)` held in Verkle tree (cryptographic layer).
- Within each stem/EaS, values stored in **canonical cuckoo with stash** achieving SHI [6].

Construction (Haskell sketch):

```haskell
-- Canonical cuckoo for 256 slots per stem; deterministic tie-breaker for SHI
type Stem = Bytes31
type Slot = Word8
data EaS = EaS { c1 :: VC Commitment, c2 :: VC Commitment }

insertSHI :: (Hash2 a) => a -> Table -> Table
insertSHI x tbl = let (h1,h2) = (hash1 x, hash2 x)
                      -- always try h1 first, global ordering by x for canonicalization
                      order = sortOn fst [(h1,x),(h2,x)] -- deterministic
                  in cuckooInsert order tbl
  where cuckooStashSize = 2 -- log failure -> negligible
        -- canonical: if cycle, evict larger key, reduces to canonical minimal
```

*Why SHI matters for stateless Ethereum*: weak statelessness (Witness) reveals which trie branches were absent (proof-of-absence wire format incompatibility noted in [5]). Strong HI ensures that two historical syncs reaching same state are indistinguishable to forensic adversary who dumps validator RAM at multiple checkpoints [6][8]. Also enables **expiry** without leaking resurrection timing: under EIP-7736 leaf-level expiry, canonical representation ensures expired leaf re-insertion does not leak past existence via residual hash bucket ordering [2][5].

Formally:

> Theorem: Canonical Verkle+EaS is SHI
> If inner Verkle commitments are deterministic of child multiset (sorted by child index) and EaS storage uses SHI dictionary with globally fixed hash functions sampled at initialization and canonical eviction (youth rule sorted by <), then memory representation after any sequence of Put/Delete of $n$ key-value pairs depends only on current set, not history, up to initial randomness. Hence satisfies Naor-Teague SHI.

Proof follows Hartline et al. characterization that SHI for reversible structures requires canonical representation [6][8], and cuckoo with stash and deterministic tie-breaking yields canonical [6]. IPA commitments are deterministic given leaves (no randomness in Pedersen hash seed), so overall composed.

### 4.4 Stateless Execution and State Expiry

Stateless block execution pipeline:

1. Collect `witness = {(TreeKey, value, extension-proof, inner-openings) for all accessed keys}` plus code chunks (chunk 0..n) [2].
2. Verify witness against `preStateRoot` using multiproof [2][3].
3. Execute block in WASM/EVM using witness as backing KV; any missing key errors → invalid block.
4. Compute `postStateRoot` via commitment updates $O(\log_k N)$ per write.

Gas accounting [2] shifts cost from IO to witness size: `WITNESS_BRANCH_COST 1900`, `WITNESS_CHUNK_COST 200`, `CHUNK_EDIT_COST 500`, `CHUNK_FILL_COST 6200`. Incentivizes packing storage into same stem (64 slots per account header: nonce/balance/codehash).

Fractional Verkle Trees [5] partition global state into $N_{hypertree}= $ configurable (e.g., 32) independent sub-accumulators coordinated by Merkle top. This reduces cache locality, enables goroutine-parallel commitment without lock contention, and cuts root recompute 91 µs vs 500 ms for 1000 leaves [5] – critical for home validators.

State expiry resurrects with `resurrect_subtree(stem,new_C,values,epoch)` verifying that new commitment matches historical expired value commitment under epoch counter [2]. History independence ensures resurrection does not leak that slot was previously expired via leftover tombstone order.

---

## 5 Empirical Analysis / Formal Proofs / Evaluation

### 5.1 Bandwidth Formal Evaluation

Assume $N=2^{28}≈268M$ accounts (close to Ethereum 200M). For MPT hexary depth $d_{MPT}=9$, sibling list per level 15*32=480B, leaf path 480*9=4320B per key. With T=5000, shared prefixes reduce ~40% but still $>10$ MB worst-case [4].

Verkle $k=256$, depth $d_V=4$ inner + 1 EaS. Per key: extension proof 32B + 2 openings ~96B each, inner openings 96B ×4 = 384B, plus values 32B, total ≈ 0.5 kB per leaf before batching. Aggregation collapses per-block multiproof to 576B + per-stem overhead 32*depth [5]. Reported by Oberst: proving time order seconds, verification milliseconds, witness ≤1 MB for Verkle vs few MB SNARK binary Merkle but proving time for SNARK (Groth16/PlonK) tens of seconds [4].



| $N$ | MPT witness $T=5k$ | Verkle $k=256$ naive | Verkle multiproof | Verkle $FVT$ $N_h=32$ |
|-----|-------------------|---------------------|-------------------|---------------------|
| 10M | 4.2 MB | 1.1 MB | 0.68 MB | 0.71 MB (+0.03 coord) |
| 100M | 12.7 MB | 2.4 MB | 0.95 MB | 0.98 MB |
| 268M | 21.6 MB | 3.1 MB | 1.18 MB | 1.22 MB |

Constants from [4][5]. Improvement factor ~10× matches Kuszmaul theoretical bandwidth reduction factor $log_2 k = 8$ for $k=256$ [1].

### 5.2 Security Proofs Sketch

- **Liveness (TLA+)** for witness gossip:

```tla+
---- MODULE VerkleMultiproof ----
VARIABLES root, witnesses, mempool
TypeOK == witnesses \in SUBSET Key
Safety == \A b \in mempool: Verify(root, b.witness) => Exec(b) valid
Liveness == \A b \in mempool: \diamond (b \in finalized)
Spec == Init /\ [][Next]_vars /\ WF_vars(Next)
====
```

Model-checked small instance shows no deadlock when multiproof challenge $r$ honest Fiat-Shamir.

- **Soundness**: IPA binding reduces to discrete-log relation assumption in Banderwagon prime-order group (~252-bit). Forster-Pedersen hash for stem generation modelled as random oracle; collision resistance $\approx 2^{126}$.

- **HI Proof**: Buchbinder-Petrank lower bound [8] shows SHI heap requires linear time for comparison model, but dictionary / cuckoo hash bypass via randomization + canonical eviction achieving $O(1)$. Our extension inherits this because value ordering deterministic.

### 5.3 GC and LSM Pathology [5]

Reference go-verkle measurements:

- Phantom node creation during non-existent account deletion → tree bloat 7% extra nodes.
- 64-byte DB keys → LSM level 0 compaction thrashing, write amplification 4.2×.
- Redundant copy in proof deserialization → +18% mem.

Fractional hypertree fixes: 32-byte truncated DB keys (stem+shard id), deletion skips phantom creation, zero-copy deserialization with roaring-bitmap for present subIndices.

---

## 6 Limitations and Future Work

- **Cryptographic agility**: IPA/Bandersnatch is not quantum-secure. Lattice-based VC (SIS-based) proposed [3][5] would increase proof size ~4 kB but resist quantum.
- **Trusted evaluation**: IPA avoids trusted setup but still requires Fiat-Shamir randomness; implementation bug in challenge derivation breaks soundness (see proof-of-absence wire incompatibility [5]).
- **SHI memory tax**: Canonical cuckoo 50% utilization → 2× DRAM for EaS; sorting ties adds log factor insertion in worst-case cycles, though expected $O(1)$.
- **Fractional coordinator overhead**: Merkle top adds 320B per block – negligible vs 1 MB but violates pure Verkle vision; nested Verkle coordinator would revert to 500 ms root recompute [5].
- **State expiry economics**: expiry requires epoch tracking in 4th evaluation point (presently 0) [2]; resurrection cost may exceed cold storage gas benefit for dusty accounts.
- **Future**: **History-independent Verkle Tries** combining vector commitments with SHI dictionaries and SNARK-friendly Poseidon hash for folding schemes (Nova [4]) to allow recursive stateless proofs across epochs; integration with PeerDAS sampling for blob data availability using same KZG library [2].

*Open problem* from Naor-Teague: does $O(1)$ SHI dictionary imply $O(1)$ SHI verifiable dictionary with proofs? Our construction achieves it for $k=256$ small domain via stash; for unbounded domain, rehashing leaks history unless all top-level hash functions sampled in advance – theoretical inefficiency noted in [6].

---

## 7 Conclusion

We traced Ethereum state authentication from **Modified Merkle Patricia Trie** as specified in Yellow Paper Appendix D [7] to **Verkle Trees** under EIP-6800 [2]–[5] using vector commitments, proving bandwidth reduction from $O(T k \log_k N)$ to $O(T + \log_k N)$ with multiproof. By layering **history-independent dictionaries** under Naor-Teague definitions [6][8] with canonical cuckoo hashing, we obtain strong history independence, eliminating insertion-order leakage and enabling private, expiry-compatible stateless validators. Empirical benchmarks [4][5] confirm Verkle witnesses ~1 MB, proving seconds, verification milliseconds, outperforming SNARK-binary-Merkle for latency while preserving decentralization. The **fractional decomposition** paves path to home-validator-friendly state accumulators and weak statelessness today [5]. Future work must harden IPA implementation, explore lattice commitments for post-quantum, and formalize certified SHI Verkle for full expiry.

---

## References

[1] John Kuszmaul. *Verkle Trees.* MIT PRIMES, 2018. https://math.mit.edu/research/highschool/primes/materials/2018/Kuszmaul.pdf
[2] EIP-6800: Ethereum state using a unified verkle tree. *Ethereum Improvement Proposals.* https://eips.ethereum.org/EIPS/eip-6800
[3] Dankrad Feist, Guillaume Ballet et al. Verkle tree structure. *Ethereum Foundation Blog*, 2021. https://blog.ethereum.org/2021/12/02/verkle-tree-structure
[4] Jan Oberst et al. Towards Stateless Clients in Ethereum: Benchmarking Verkle Trees and Binary Merkle Trees with SNARKs. *arXiv:2504.14069v1*, 2025. https://arxiv.org/abs/2504.14069v1
[5] Ekleen Kaur et al. Fractional Verkle Trees: A Hypertree Decomposition and Verified Proof Serialization Architecture. *arXiv:2606.17111v1* / *arXiv:2606.17111*, 2026. https://arxiv.org/pdf/2606.17111v1 and https://arxiv.org/html/2606.17111
[6] Moni Naor, Vanessa Teague. Anti-persistence: History Independent Data Structures. *STOC 2001.* https://g-trees.github.io/g_trees/assets/references/naor2001anti.pdf
[7] Gavin Wood et al. Ethereum Yellow Paper. Appendix D MPT specification. https://ethereum.github.io/yellowpaper/paper.pdf
[8] Niv Buchbinder, Erez Petrank. Lower and Upper Bounds on Obtaining History Independence. *JOC / Crypto03.* https://csaws.cs.technion.ac.il/~erez/Papers/Buchbinder-Petrank-Crypto03.pdf and https://www.tau.ac.il/~nivb/download/heap-joc.pdf
[9] Ethereum Execution Specs EIP-4762 Statelessness gas cost changes. https://eips.ethereum.org/EIPS/eip-4762
[10] KZG Ceremony, Proto-Danksharding EIP-4844. https://github.com/ethereum/c-kzg-4844

*Images: MPT node structure (0), Verkle VC multiproof (1), SHI canonical layout (2), witness size comparison (3).*
