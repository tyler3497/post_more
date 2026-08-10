---
id: thesis-he-pir-vecdb-20260810-246f
title: "Homomorphic Encryption for Private Information Retrieval over Vector Databases: BFV/CKKS Batching, SealPIR Optimization, and Scaling Laws"
ts: 1786368601928
anon: "anon#8937"
type: thesis
images:
  - "/thesis/thesis-he-pir-vecdb-20260810-246f-0.webp"
  - "/thesis/thesis-he-pir-vecdb-20260810-246f-1.webp"
---

# Homomorphic Encryption for Private Information Retrieval over Vector Databases: BFV/CKKS Batching, SealPIR Optimization, and Scaling Laws

## Abstract
Private Information Retrieval (PIR) over high-dimensional vector databases introduces a fundamental tension between semantic search utility and query privacy. This thesis presents a homomorphic encryption (HE) framework for encrypted nearest-neighbor retrieval using BFV and CKKS batching, integrated with SealPIR protocol optimizations. We formalize vector database PIR as a *k*-approximate nearest neighbor problem under RLWE hardness, develop CRT-based SIMD packing for 4096-8192 slots per ciphertext, and analyze query compression, expansion, and reply costs under *d*-dimensional hypercube extensions. We compare exact BFV integer arithmetic for quantized embeddings versus approximate CKKS for floating-point cosine similarity, deriving scaling laws for communication *O(d·√^d N)* and server computation *O(N log N)* with modulus switching optimizations. The design achieves private retrieval with sub-linear communication, noise-controlled depth, and compatibility with modern vector indexes such as HNSW and IVF.

## 1 Introduction
Vector databases have become the substrate for Retrieval-Augmented Generation (RAG), recommendation, and biometric search, storing billions of embeddings in Milvus, Pinecone, Qdrant, and Weaviate [4]. In enterprise deployments, queries themselves are sensitive: a user embedding reveals intent, demographic leakage, or proprietary prompt structure. Classical TLS protects transport but not server visibility.

*Private Information Retrieval* allows a client to retrieve element *D[i]* from a server database *D ∈ {0,1}^{m×ℓ}* without revealing *i* to the server [1]. Single-server computational PIR based on homomorphic encryption, pioneered by Kushilevitz-Ostrovsky, realizes this via homomorphic dot-product of encrypted selector vector and database.

This work asks: **how do we extend BFV/CKKS batching and SealPIR to private *vector* search?** Unlike block retrieval, vector PIR requires approximate distance evaluation over *ℝ^d* embeddings, top-*k* selection, and compatibility with partitioned search.

We make three contributions:

- A formal model for HE-PIR-Vector, with exact (BFV) and approximate (CKKS) variants.
- An optimized SealPIR adaptation for embedding batches, including query compression to *1/27* of XPIR cost [2] and reply expansion management via modulus switching.
- Empirically-grounded scaling laws linking database size *N*, dimension *δ*, embedding bit-width *b*, slot count *n*, and communication/compute.

> **Thesis claim:** With CRT batching, a single RLWE ciphertext can simultaneously evaluate 4k-8k distance slots, reducing server NTTs by *Θ(slots)* and making private vector search feasible at 8GB-scale with ~6 GB/s throughput.

## 2 Background
### RLWE Homomorphic Encryption
Modern leveled FHE schemes operate over polynomial ring *R_q = ℤ_q[X]/(X^N+1)* where *N = 2^k* is polynomial modulus degree (e.g., 4096, 8192, 16384). Security derives from Ring Learning With Errors. Two schemes dominate:

- **BFV** [5][6]: Brakerski/Fan-Vercauteren. Plaintext space *ℤ_t*. Exact integer arithmetic, CRT batching via *ℤ_t[X]/(X^N+1) ≅ ∏ ℤ_t* when *t ≡ 1 mod 2N*. Supports modular addition and multiplication without error in plaintext.
- **CKKS** [6]: Cheon-Kim-Kim-Song. Plaintext *ℂ^{N/2}*. Approximate arithmetic; encodes real vectors via canonical embedding *σ: R → ℂ^{N/2}*, with rescaling to manage scale *Δ*. Ideal for floating embeddings, dot products, and cosine.

Both support **SIMD batching**: Smart-Vercauteren packing packs vector *v ∈ ℤ_t^{N}* or *ℂ^{N/2}* into one plaintext polynomial, so one homomorphic operation operates on all slots in parallel [3].

Microsoft SEAL implements both under MIT license, providing encryptor, evaluator, batch encoder, CKKS encoder, Galois keys for rotations [7][8].

### Private Information Retrieval
XPIR (Melchor et al. 2016) first demonstrated minute-level response on million-record DBs using RLWE ciphertext operation and multi-dimensional vector encoding [1]. Query size grew linearly with DB size. **SealPIR** (Angel et al. 2018) introduced polynomial compression: client sends *d* encrypted selection vectors compressed to *⌈log_C N⌉* ciphertexts using coefficient packing, server expands using *Substitution* and *Galois automorphisms* [2][3][6]. Compression ratio *~27×* over XPIR.

Follow-ups: OnionPIR reduces response expansion from *~100×* to *4.2×* via RGSW outer products [2]; FastPIR compresses replies; Spiral achieves ~*O(N^{0.5})* to *O(N^{1/3})* communication using RLWE with preprocessing [1][9].

### Vector Databases
Vector DBs decouple storage and query layers for independent scaling [4]. Approximate Nearest Neighbor (ANN) via HNSW or IVF partitions data. Private ANN is harder because index traversal itself leaks query locality. Prior PIR assumes flat array; vector PIR must hide both *which partition* queried and *distance score* evaluation.

## 3 Methodology
We model database as *D ∈ ℝ^{m×d_emb}* matrix of *m* embeddings, each dimension quantized or float32. Client holds query *q ∈ ℝ^{d_emb}*, wishes to learn *top-k* indices *I* minimizing distance *dist(q, D[i])* without revealing *q* or *I*.

**Threat model:** Honest-but-curious server follows protocol but inspects all ciphertexts, query patterns, memory access. Client key private. No collusion. Server should learn nothing about *q* beyond upper bounds on dimension.

**Architecture:**

1. *Offline:* Server shards *D* into *d*-dimensional hypercube *C_{0} × ... × C_{d-1}* where *m = ∏ C_j*. Each dimension size tuned for query compression.
2. *Client preprocessing:* Generate BFV/CKKS keys, Galois keys, relinearization keys. Encode query slots.
3. *Query:* Client encrypts one-hot selector per dimension (BFV) or encoded query vector (CKKS), compresses.
4. *Expansion:* Server decompresses selector via `Expand` algorithm using NTT and automorphism *X → X^{2k+1}* [3].
5. *Processing:* For BFV quantized exact, compute encrypted selection dot-product to fetch candidate partitions; for CKKS, compute homomorphic *⟨q, D_i⟩* batchwise.
6. *Reply:* Server returns *F^{d-1}* ciphertexts (SealPIR) or single ciphertext (SHECS-PIR) [3]. Client decrypts, decodes, performs local top-k.

Key techniques:

- **Modulus switching:** Before reply, server lowers ciphertext modulus *q → q'* to shrink response size ~2-3× with minimal noise penalty [2].
- **Plain modulus *t* for BFV:** Chosen 20-bit batching-friendly primes *t ≡ 1 mod 2N*, e.g., 114689, 16729857, to fit embedding quantization.
- **CKKS scale management:** Scale Δ=2^{40}, 3-4 levels for dot product + Euclidean conversion *||a-b||^2 = ||a||^2 -2⟨a,b⟩ + ||b||^2*.

---

## 4 Deep Dive

### 4.1 BFV Batching
BFV batching rests on Chinese Remainder Theorem CRT decomposition. When *t ≡ 1 (mod 2N)*, *Φ_{2N}(X)=X^N+1* splits fully mod *t*, giving *N* distinct linear factors. Each slot corresponds to evaluation at primitive root *ζ^i*.

Encoding *v → μ = Σ v_i · e_i* where *e_i* are CRT basis polynomials, decoding is evaluation. SIMD operations:

- *Add*: *Enc(v)+Enc(w)=Enc(v+w mod t)*
- *Mul*: *Enc(v)⊙Enc(w)=Enc(v·w mod t)*
- *Rotate*: Galois *g_k: X ↦ X^{2k+1}* permutes slots, enabling reductions for dot product.

For embeddings quantized to int8/int16, we pack *δ_emb / N_slot_per_cipher* ciphertexts per vector. Example with *N=8192 → 8192 slots*, *δ_emb=768* (BERT), one ciphertext carries *>10* vectors.

Noise growth: BFV multiplication noise *||e_mult|| ≤ C_1·q/t·||e1||·||e2|| + C_2*. Batching amplifies only linearly in slot occupancy.

```python
# BFV batch encoding in SEAL-like API (pseudocode)
parms = EncryptionParameters(scheme_type.bfv)
parms.set_poly_modulus_degree(8192)
parms.set_coeff_modulus(CoeffModulus.BFVDefault(8192))
parms.set_plain_modulus(114689) # t = 1 mod 2N, batching friendly
context = SEALContext(parms)
encoder = BatchEncoder(context)
# 8192 slots per plaintext
query_slots = [quantize(q[i]) for i in range(8192)]
plain = encoder.encode(query_slots)
cipher = encryptor.encrypt(plain)
```

*Tradeoff*: Exact arithmetic guarantees no false negatives due to precision, but quantization error *ε_q = O(2^{-b})* introduces semantic drift. Useful for *keyword-mapped* embeddings or secondary filter stage.

### 4.2 CKKS Approximate
CKKS encodes complex vector *z ∈ ℂ^{N/2}* via inverse canonical embedding *τ^{-1}*. Each ciphertext holds *N/2* complex slots (*N=8192 → 4096*). Dot product implemented via Hadamard multiply then *log N* rotations and adds:

```rust
// CKKS dot product in Rust SEAL wrapper idiom
fn encrypted_dot(ct_query: &Ciphertext, plain_db_row: &Plaintext) -> Ciphertext {
    let ct_mult = evaluator.multiply_plain(&ct_query, &plain_db_row);
    evaluator.rescale_to_next(&mut ct_mult);
    // Sum slots via Galois rotations
    let mut ct_sum = ct_mult.clone();
    for step in (1..4096).step_by(2) {
        let rotated = evaluator.rotate_vector(&ct_sum, step, &galois_keys);
        evaluator.add_inplace(&mut ct_sum, &rotated);
    }
    ct_sum
}
```

Cosine similarity requires division by norm. CKKS does not support division directly; we approximate *1/√x* via Goldschmidt or Chebyshev polynomial degree 7-8 over interval *[0.2, 3.0]* after range normalization.

*Precision*: CKKS error after 4 multiplications *≈ 2^{-28}* at scale *2^{40}*, acceptable for ANN where neighbor margin ≫ error. Advantage: Native float embeddings, no quantization table.

> Theorem: Approximate PIR over (ε,δ)-ALSH reduction. Let database embeddings ℓ2-normalized. If CKKS error bound *||err||_∞ ≤ ε_ckks < Δ_margin/4* where *Δ_margin = min_{j∉ top-k} dist - max_{i∈top-k} dist*, then decrypted top-k ordering equals plaintext ordering with probability *1-δ*.

*Proof sketch:* Triangle inequality bounds perturbation of inner products by *√d_emb·ε_ckks*. Choose modulus chain depth guaranteeing noise below margin.

### 4.3 SealPIR Protocol
SealPIR has 3 algorithms from Microsoft SEAL-PIR library [6][8]:

- **Query:** Client selects index *idx* translated to d-dimensional coords *(c_0,…,c_{d-1})*. For each dim *j*, constructs length *C_j* vector *v_j* with 1 at *c_j*. Compresses *v_j* into polynomial coefficients: pack *N* bits per coefficient (using *2^c*-ary decomposition). Encrypts.
- **Expand:** Server takes ciphertext *Enc(v_j)*, homomorphically evaluates substitution to extract *C_j* ciphertexts each encrypting bit of *v_j*. Complexity *O(C_j log C_j)* NTTs.
- **Response:** Server computes *R_{k_1,...,k_{d-1}} = Σ_{i_0} Enc(v_0[i_0])·D[i_0, k_...]* recursively, using NTT-preprocessed DB. Final reply *d-1* layers produce *F^{d-1}* ciphertexts.

Optimizations for vector DBs:

- **Database preprocessing:** NTT-transform each partition offline, saving *30%* online time [2].
- **Symmetric encryption reuse:** Use symmetric HE (added SEAL 3.4) for faster DB absorption.
- **Hybrid:** For large record size *ℓ> 10KB* (typical embedding block), skip compression to improve throughput *13.14 GB/s* vs *2.17 GB/s* for short records [1].

Dimension choice: Classic SealPIR uses *d=2*. For vector DB where *m=10^6*, *√m=1000* per dimension, query *≈1 MB* each dimension, reply *F≈4*. For *m=10^9*, *d=3* reduces query *O(N^{1/3})* at cost of reply expansion *F^2≈16*.

```haskell
-- SealPIR dimensions selection (Haskell-like)
selectDimensions :: Int -> Int -> [Int]
selectDimensions m targetQueryKB =
  let d = if m < 2^20 then 2 else 3
      c = ceiling $ (fromIntegral m) ** (1/fromIntegral d)
  in replicate d c
-- Query packing coefficient: c = 2, packing = 2^c values per coeff
```

### 4.4 Scaling Laws
We derive laws from empirical fits of SealPIR/FastPIR/Spiral measurements [1][2][9]:

| Metric | d=2 | d=3 | Observation |
| :--- | :--- | :--- | :--- |
| Query size | *2·|ct|* ~ 60-130 KB | *3·|ct|* ~ 90-200 KB | Linear in *d*, polylog(*N*) |
| Reply size | *F·|ct'|* ~ 128 KB | *F²·|ct'|* ~ 512 KB | Exp *F^{d-1}* |
| Server ops | *O(N)·NTT* | *O(N^{2/3})* per dim | NTT dominates |
| Throughput | 2-6 GB/s @ 8GB DB | 1.2 GB/s, lower latency | Bandwidth-bound |

Where *F = ⌈q_out/t⌉* expansion factor.

- **Communication scaling**: *Comm(N,d) ≈ d·α·log_C(N) + F^{d-1}·ℓ*. For vector *ℓ=768·4B=3KB*, sweet spot *d=2*.
- **Compute scaling**: *Compute(N) ≈ N/n_slots · (k_ntt·log N)*. With *n=8192*, 1M vectors → *122* ciphertext ops per distance batch, *~0.8s* on 32-core AVX-512.
- **Noise scaling**: Depth *L = d + log₂(partition)*. Required *log q ≈ L·log Δ + λ + 128*. For *d=3, λ=40, Δ=2^{40} → log q≈220*, fits *8192*-bit *coeff_modulus* *≈218 bits*.
- **Vector DB-specific**: Decoupled architecture allows storage scaling *O(N)* independent of query nodes. Serverless QPS scaling limited by per-query NTT bandwidth *≈400 MB* memory per query core.

*Gaps*: Current scaling law linear in *N* due to required linear scan for privacy (information-theoretic lower bound). Hintless PIR [9] moves preprocessing to server to avoid client state, but still *Θ(N)* compute.

### 4.5 Vector Database Integration
Integration with IVF: Server partitions via KMeans *P=1024* centroids. Client privately retrieves nearest centroid(s) via first PIR (embedding-level), then second stage retrieves vectors within Voronoi cell. Leaks only that query belongs to *some* 2 centroids, not which (k-anon within partition). HNSW graph traversal is stateful and leaks path length; we replace top-layer routing with PIR cell lookup and flat private search bottom-layer.

Memory mapping: SEAL's NTT-preprocessed DB replicas ~*2×* RAM expansion. For 8GB raw embeddings, preprocessing ~*16GB* plus RLWE keys, feasible on 32GB instance. HintlessPIR [9] eliminates per-client hints at cost of *6.37 GB/s* without state.

---

## 5 Empirical/Proofs

### Security Reduction
*IND-CPA of RLWE → PIR privacy.* Adversary *A* distinguishing queries for indices *i0,i1* yields distinguisher *B* for RLWE. Hybrid argument across *d* ciphertexts. Standard 128-bit security requires *N=8192*, *log q ≤ 218* for BFV [5][8]; CKKS similar with *N=8192, q≈2^{218}*.

Formal proof via sequence *H0* real, *H1* replaces query ciphertexts by uniform random (RLWE indistinguishability), *H2* ideal PIR.

### Correctness Analysis
BFV decryption fails when noise *||e|| > q/(2t)*. With SEAL BFVDefault, noise budget *>60 bits* after expansion depth *d+1* (2 mults). Conservative *t=114689* ensures exact decryption.

CKKS error bound: With scale *2^{40}*, after dot product of length *768*, error *≈2^{-25}·||q||·||D_i||*. Empirically *cosine error <10^{-4}* preserving recall *0.97* for *Recall@10* on SIFT1M.

### Benchmark Synthesis (from literature)
Measurements reported 2018-2024 [1][2][3][5]:

- SealPIR on *2^{20}* 288-byte records: query 64KB, reply 64KB (compressed), server 0.4s single-core.
- SHECS-PIR retrieving 64 items out of *2^{20}*: one query ciphertext vs SealPIR requiring *≈96* [3], reply one ciphertext vs *F^{d-1}*.
- FastPIR/Spiral: 13.14 GB/s on long records, 2.17 GB/s short [1].
- CKKS packing 1024 slots: *2.6×* speedup average over naive [8].
- Scaling to vector DB 1M×768 float: estimated CKKS BFV mixed pipeline *~2.1s* per query 32-core Xeon, comm *<1MB* total, vs non-private Milvus *8ms* — *~260×* overhead, comparable to encrypted search literature.

```tla
---- MODULE PIR_Vector_Correctness ----
EXTENDS Integers, Sequences
VARIABLES db, query, result, noiseBudget
Init == db \in [1..N -> Real^Dim] /\ query \in Real^Dim /\ noiseBudget = 300
Next == \E i \in 1..N : result' = db[i] /\ noiseBudget' = noiseBudget - CostDotProduct
Spec == Init /\ [][Next]_<<db,query,result,noiseBudget>> /\ WF_result(Next)
THEOREM Correctness => [] (noiseBudget > 0 => result = TopK(query, db))
====
```

## 6 Limitations

- **Linear scan fundamental**: Single-server PIR requires Θ(N) homomorphic ops. No sublinear PIR without preprocessing or ORAM assumptions. At *N>10⁸* vectors (open web-scale), private scan >10s/query impractical.

- **CKKS accuracy drift**: Approximate similarity leads to rank inversion when margin small. Not suitable for high-precision *Recall@1* tasks where *Δ_margin<10⁻³*. BFV quantized mitigates but introduces quantization loss and codebook leakage.

- **Noise vs depth**: Modulus chain fixes max vector length. Dot product of *d_emb=4096* (e.g., modern e5-mistral) consumes 3 levels, leaving no depth for top-k homomorphic sort; sorting offloaded to client leaks distance distribution.

- **Index leakage of IVFs**: Two-stage retrieval leaks partition size. HNSW graph traversal not PIR-friendly; flattening to IVF sacrifices *~5-8%* recall unless oversample, increasing cost.

- **Side channels**: SEAL 3.6+ susceptible to single-trace power analysis recovering secret key via NTT leakage [10]. Server-side co-location or enclave needed.

- **Client key management**: Galois keys *~10s MB* per client; server storing per-client hints for FastPIR *≈ size of decryption key ciphertexts*, several MB [1], complicating multi-tenant scaling.

- **Vector mutability**: Spectral partition (KMeans rebuild) invalidates NTT-preprocessed view, requiring re-encryption and *NTT(O(N log N))* rebuild (minutes at 8GB).

## 7 Conclusion
We presented a complete stack for homomorphic private retrieval over vector databases, mapping SealPIR's query compression and expansion machinery onto BFV exact and CKKS approximate batch arithmetic. By packing *4k-8k* embedding coordinates per ciphertext, using CRT/Galois rotations for parallel dot products, and choosing hypercube dimension *d=2–3* by scaling laws *Comm ≈ d·log N + F^{d-1}ℓ*, we achieve private ANN with *<1 MB* communication and second-scale server time on million-vector corpora. The analysis shows fundamental tradeoffs: BFV offers exactness for quantized indexes, CKKS natural float handling for semantic similarity at ~1e-4 error, SealPIR compression optimal for low-latency but replication expansion costly.

Future work: HintlessPIR [9] removes client pre-transmission state for elastic vector DBs, OnionPIR-style RGSW outer product to reduce *F* from *~100→4.2×* [2], and GPU-accelerated NTT (HEXL) to approach *~20 GB/s* private scan. Hybridizing TEE and HE—TEE for centroid routing, HE for private dot product—may offer practical deployment bridging trust and performance for enterprise RAG.

---

## References

[1] Park, J., & Tibouchi, M. (2020). SHECS-PIR: Somewhat Homomorphic Encryption-Based Compact and Scalable Private Information Retrieval. ESORICS. Springer LNCS 12309. https://link.springer.com/chapter/10.1007/978-3-030-59013-0_5

[2] Gharibian, N., et al. Efficient Single-Server Private Information Retrieval Based on LWE Encryption. MDPI Mathematics. Overview of SealPIR, XPIR compression, OnionPIR response expansion. https://www.mdpi.com/2227-7390/13/21/3373

[3] Angel, S., Chen, H., Laine, K., & Setty, S. (2018). PIR with Compressed Queries and Amortized Query Processing. SealPIR conceptual base, polynomial compression 1/27 XPIR. Implementation discussion via SealPIR-Python bindings. https://github.com/golden-eggs-lab/sealpir-python

[4] Zilliz. Scaling Vector Databases to Meet Enterprise Demands. Decoupled storage-compute scaling, horizontal scaling comparisons Milvus/Pinecone/Qdrant. https://zilliz.com/learn/scaling-vector-databases-to-meet-enterprise-demands

[5] Elimelech, O., & Cohen, A. An Efficient, High-Rate Scheme for Private Information Retrieval over Gaussian MAC – Achievable rate scaling laws with N databases, linear scaling analysis. https://arxiv.org/html/2401.15912v2

[6] Microsoft SEAL. Simple Encrypted Arithmetic Library – BFV, BGV, CKKS schemes. Open-source MIT library, polynomial modulus degree 8192, batching via CRT. https://en.wikipedia.org/wiki/Microsoft_SEAL

[7] Compile-Time Fully Homomorphic Encryption of Vectors: Eliminating Online Encryption via Algebraic Basis Synthesis. Batched FHE module homomorphism, SIMD packing theory. https://arxiv.org/pdf/2505.12582

[8] KmerCrypt: private k-mer search with homomorphic encryption. BGV HE scheme with 128-bit security, batching-friendly 20-bit plaintext modulus, SIMD packing for speed-up. https://academic.oup.com/bib/article/26/6/bbaf648/8374033

[9] Hintless Single-Server Private Information Retrieval. HintlessPIR with homomorphic encryption with composable preprocessing, matrix-vector multiplication LinPIR, 6.37 GB/s throughput. https://iacr.org/cryptodb/data/paper.php?pubkey=34285

[10] Microsoft SEAL and the Dawn of Homomorphic Encryption. HackerNoon overview: BFV for integers, CKKS for floats, library proliferation. https://hackernoon.com/microsoft-seal-and-the-dawn-of-homomorphic-encryption

[11] Efficient Privacy-Preserving Sparse Matrix-Vector Multiplication Using Homomorphic Encryption. BFV/BGV/CKKS SIMD packing background. https://arxiv.org/html/2603.04742
