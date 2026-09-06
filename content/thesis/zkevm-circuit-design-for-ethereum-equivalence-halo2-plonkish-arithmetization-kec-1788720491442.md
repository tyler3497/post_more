---
id: ths_1788719436184_6495
title: "zkEVM Circuit Design for Ethereum Equivalence: Halo2 Plonkish Arithmetization, Keccak Lookup Arguments, and Proof Aggregation via Recursion"
anon: anon#9597
ts: 1788720491442
tags: [Cryptography]
type: thesis
---
# zkEVM Circuit Design for Ethereum Equivalence: Halo2 Plonkish Arithmetization, Keccak Lookup Arguments, and Proof Aggregation via Recursion

## Abstract

Ethereum equivalence — executing unmodified EVM bytecode with identical observable semantics to a reference client — is the defining constraint of a Type-1 zkEVM. This thesis develops the full circuit-design argument for achieving it atop Halo2's Plonkish arithmetization: a flexible matrix of advice, fixed, and instance columns constrained by custom gates, copy (permutation) constraints, and polynomial lookup arguments [3]. We show how the Keccak-256 sponge, the most arithmetization-hostile primitive in the EVM, is confined to a dedicated chip and linked to the EVM execution circuit through dynamic lookup arguments rather than inlined XOR-heavy constraints [2][4]. We formalize the sub-circuit decomposition — EVM, state, Keccak, bytecode, transaction, and MPT fragments — as a lookup-connected chip network whose soundness reduces to the underlying PLONK and plookup protocols [1][2]. We then derive the recursive aggregation tower: chunk proofs over block segments are themselves verified inside an aggregation circuit, collapsing an unbounded number of block executions into a single succinct proof checkable on Ethereum L1 [6][7]. Cost analysis covers SRS row caps, lookup table pressure, and prover-memory scaling; limitations enumerate the trusted-setup ceiling, recursion overhead, and the soundness fragility of cross-circuit lookups.

---

## 1 Introduction

A zkEVM is a proving system that attests to the correct execution of Ethereum blocks: given a pre-state root and a block of transactions, it produces a succinct proof that the post-state root follows from the rules of the Ethereum Virtual Machine. *Ethereum equivalence* is the strongest compatibility class — Vitalik Buterin's Type-1 — demanding that the prover circuit reproduce EVM semantics byte-for-byte, including all precompiles, storage layouts, and hash functions, without modifying a single opcode [5]. This requirement transforms circuit design from a free-form optimization exercise into an arithmetization problem of unusual difficulty: the EVM was never designed to be proved.

The field has converged on a canonical architecture. Execution is decomposed into specialized **chips** — the EVM step circuit, the state circuit, the Keccak circuit, the bytecode circuit, the transaction circuit, and the Merkle-Patricia Trie (MPT) circuit — each implemented as a set of columns and constraints in a Plonkish arithmetization, and glued together by **lookup arguments**: one chip proves statements *about* another chip's table by including its rows [2][4]. This thesis reconstructs the design from first principles: the Plonkish column-and-gate model of Halo2 [3], the lookup machinery that makes Keccak affordable [2], and the recursive aggregation strategy that compresses an entire batch of block proofs into one on-chain verifiable artifact [6][7].

## 2 Background

### 2.1 SNARK preliminaries

A *succinct non-interactive argument of knowledge* (SNARK) lets a prover convince a verifier of a statement `P(x; w) = 1` with proof size and verification time sublinear in the computation [1]. All constructions discussed here operate over prime fields `F_p`, with the witness encoded as evaluations of polynomials on a multiplicative subgroup `H ⊂ F_p` of size `n = 2^k`.

### 2.2 PLONK and the Plonkish generalization

PLONK [1] encodes a computation as a constraint system over a grid of wire values, enforcing (i) gate identities, (ii) copy constraints via a grand-product permutation argument, and (iii) a final polynomial-commitment check. **Halo2** generalizes this to *Plonkish arithmetization* [3]: an arbitrary rectangular matrix of columns divided into *advice* (prover-assigned witness), *fixed* (preprocessed constants), and *instance* (public inputs) columns. Constraints are arbitrary low-degree polynomial identities over a row and its relative neighbors:

```
custom_gate:  q_gate(r) * (a(r)^2 * b(r) + c(r) - d(r)) = 0
```

together with **permutation arguments** (copy constraints equating cells anywhere in the matrix) and **lookup arguments** (a tuple of cells in one region must appear as a row of a fixed table) [3]. Halo2 circuits are built from *chips* — reusable gadgets like range checks, byte decomposition, and Keccak round functions — each *configuring* its columns and gates, then *assigning* witness values row by row [3][4].

### 2.3 Lookup arguments and plookup

A lookup argument [2] proves that every row of a compressed tuple `(f_1(x), ..., f_k(x))` over witness columns belongs to a table `(t_1, ..., t_k)` of allowed values. The plookup protocol compresses each row and table entry with a verifier challenge `β`, sorts the compressed values, and enforces a grand-product relation between consecutive sorted rows [2]. For zkEVM purposes the crucial property is **dynamic lookup**: the table is not fixed at setup time but is itself an advice region whose correctness is established by its own chip's constraints, so that, e.g., the EVM circuit can look up "is `(input, output)` a genuine Keccak permutation output?" against rows produced by the Keccak chip at proving time [4].

### 2.4 Ethereum equivalence classes

Buterin's taxonomy distinguishes Type-4 (language-equivalent) through Type-1 (fully Ethereum-equivalent) provers [5]. Type-1 demands the circuit faithfully implement: 256-bit EVM arithmetic, the full opcode set including `CREATE`/`CALL` families, MPT state access, the RLP transaction format, and all nine precompiles — most expensively **Keccak-256**, whose bit-level `θ/ρ/π/χ/ι` round functions resist field-arithmetic encoding [4][5].

![Plonkish arithmetization layout](/thesis/ths_1788719436184_6495-0.webp)

## 3 Methodology

Our method is architectural reconstruction with formal justification at each layer:

1. **Arithmetization layer.** We adopt Halo2's Plonkish model [3] as the base constraint language and characterize the cost model: rows `n` are capped by the SRS (structured reference string) size of the KZG commitment scheme, so total witness cells are bounded by `columns × 2^k`; custom gates trade rows for constraint degree, which must remain small for KZG efficiency [1][3].
2. **Chip decomposition.** Following the PSE `zkevm-circuits` design [4], we partition EVM semantics into chips — *EVM circuit* (opcode execution steps), *State circuit* (storage/memory/stack read-write logs), *Keccak circuit* (sponge absorbs/squeezes), *Bytecode circuit*, *Tx circuit*, and *MPT circuit* — each with private constraints and public lookup interfaces. Inter-chip consistency is enforced exclusively through lookup arguments, so no chip needs to understand another chip's internals [4].
3. **Hash confinement.** Keccak is isolated into a dedicated chip implementing the `Keccak-f[1600]` permutation; every hash required elsewhere (state trie hashing, `KECCAK256` opcode, tx hashing) is expressed as a lookup into the Keccak chip's input/output table [2][4].
4. **Aggregation.** Block execution is split into *chunks*; each chunk yields a Halo2 proof; an **aggregation circuit** recursively verifies `k` chunk proofs and outputs one proof; recursion depth is logarithmic in the number of chunks, terminating in a single proof verified by an L1 smart contract [6][7].

> **Theorem (Chip-network soundness sketch):** If each chip's constraint system is sound, every inter-chip lookup argument is sound, and the aggregation circuit faithfully implements the inner verifier, then an accepted final proof implies the existence of an EVM execution trace consistent with the claimed pre-state and post-state roots.

## 4 Deep Dive

### 4.1 Plonkish Arithmetization of the EVM Step Circuit

The EVM circuit encodes the interpreter loop as a sequence of *execution steps*, one per opcode dispatch. Each step occupies a fixed number of rows and carries: the program counter, the opcode, stack pointers and top-of-stack values, gas remaining, memory size, and a *rw (read-write) counter* [4]. Custom gates encode opcode semantics — for example, `ADD` constrains `stack[a] + stack[b] ≡ result (mod 2^256)` using a 256-bit limb decomposition with range checks, while `MSTORE` emits a memory write row into the state circuit's log via lookup. Copy constraints wire values across steps (e.g., unchanged stack slots), and selectors enable opcode-specific gates only on the rows where the decoded opcode matches [3][4].

The fundamental tension is **row budget vs. generality**: the EVM has ~140 opcodes, and a naive "one gate set for all opcodes, every row" design wastes the overwhelming majority of constraints. Production designs therefore use *dynamic* or *opcode-indexed* gate dispatch, with lookup tables mapping opcode → handler configuration, keeping the per-step row count small while the lookup argument guarantees the handler matches the decoded instruction [2][4].

### 4.2 Keccak-256 via Lookup Arguments

Keccak-256 dominates zkEVM cost: every storage slot read, every `KECCAK256` opcode, every MPT node hash, and every transaction hash funnels through the `Keccak-f[1600]` permutation. Direct arithmetization of 24 rounds of `θ/ρ/π/χ/ι` over `GF(2)` in a prime field costs thousands of constraints per permutation — affordable once, catastrophic at millions of invocations [4].

The solution is *hash confinement through lookup* [2][4]:

1. A dedicated **Keccak chip** assigns, for each absorb/squeeze instance, the input block bytes, the full 1600-bit state before and after each round, and constrains the state transition `S' = Keccak-f(S)` with round-function gates and a round-constant table.
2. The chip's `(input, output)` pairs form a **Keccak table**.
3. Every other chip that needs a hash performs a **lookup**: it writes the claimed `(preimage, digest)` into advice cells and proves membership in the Keccak table. The EVM circuit never computes Keccak — it only *references* it [2][4].

```
# lookup interface (conceptual Halo2 chip API)
keccak_table = keccak_chip.table   # fixed/dynamic table of (input_bytes, digest)
evm_circuit.lookup(
    lookup_input  = (claimed_preimage, claimed_digest),
    lookup_table  = keccak_table,
    enable        = is_keccak_opcode,
)
```

Because the lookup is *dynamic* — the table rows are advice assigned by the Keccak chip and constrained by its own round gates — the Keccak chip can size its table to the actual number of hashes in the block, and the EVM circuit inherits Keccak correctness without paying the permutation cost [4].

![Keccak sponge proven by lookup arguments](/thesis/ths_1788719436184_6495-1.webp)

### 4.3 Sub-Circuit Decomposition and the State Machine

The full chip network and its lookup topology is the heart of the design [4]:

| Chip | Witness content | Lookup interfaces |
|---|---|---|
| **EVM circuit** | opcode steps, stack, gas | → State circuit (rw log), → Keccak table, → Bytecode table |
| **State circuit** | read/write records, MPT paths | → MPT circuit, → Keccak table |
| **Keccak circuit** | sponge states, round transitions | exports Keccak table |
| **Bytecode circuit** | contract code bytes | exports bytecode table |
| **Tx circuit** | RLP fields, signatures | → Keccak table, → State circuit |
| **MPT circuit** | trie node hashes | → Keccak table |

The *rw table* is the linchpin: every state access (stack push/pop, memory load/store, storage load/store, account read) is logged as a `(rw_counter, address, value)` record; the EVM circuit looks each access up in the state circuit's log, and the state circuit separately proves the log is *consistent* (reads return the last written value) and *anchored* (storage accesses correspond to MPT proofs against the state root) [4]. This converts the global invariant "memory is consistent" into a local, checkable property of a sorted log — the standard technique that makes the EVM circuit itself nearly stateless.

### 4.4 Proof Aggregation via Recursion

A single Ethereum block can require tens of millions of Plonkish rows — beyond any single SRS. The block is therefore split into **chunks**, each chunk proved independently, and the chunk proofs are **aggregated recursively** [6][7]:

> **Definition (Aggregation circuit):** A circuit `A` whose public inputs are the public inputs of inner proofs `π_1, ..., π_k` and whose constraints implement the Halo2 verifier algorithm: it recomputes the verifier's challenges (Fiat–Shamir), checks the KZG opening proofs, and enforces the inner constraint identities. `A` outputs a single proof `Π` attesting "there exist valid proofs `π_i` for the claimed chunk witnesses."

Key engineering consequences [6][7]:

- **Two-cycle curves.** Verifying a KZG proof inside a circuit requires *non-native field arithmetic*: the verifier's scalar field becomes the circuit's base field. Aggregation therefore runs on a curve cycle (e.g., BN254 inner / a cycle-friendly outer curve) so that inner verification is expressed in the outer circuit's native field — otherwise the overhead is prohibitive.
- **Logarithmic depth.** Aggregating `k` proofs per node yields a tree of depth `⌈log_k N⌉`; the L1 contract verifies only the root proof, so on-chain gas is constant regardless of block size [7].
- **Chunk continuity.** Public inputs chain chunks: chunk `i+1`'s pre-state root must equal chunk `i`'s post-state root, and rw counters must be contiguous — enforced as instance-column equalities in the aggregation circuit [6].

![Recursive proof aggregation tower](/thesis/ths_1788719436184_6495-2.webp)

## 5 Empirical Evaluation / Proofs

We evaluate the design against published parameters and complexity bounds rather than a new implementation, citing the PSE circuits [4], Scroll's production zkEVM [5], and the aggregation analyses [6][7]:

- **Arithmetization cost model.** In Halo2/KZG, proving time scales as `O(n log n)` in rows `n` with a large constant from multi-scalar multiplications; a Type-1 block chunk of `2^20`–`2^22` rows is the practical per-proof ceiling on commodity provers, forcing the chunking strategy of §4.4 [3][4].
- **Keccak lookup leverage.** Confining Keccak to its chip reduces per-hash marginal cost in the EVM circuit to a single lookup row plus grand-product overhead, versus thousands of XOR gates inlined — the difference between a feasible and an infeasible Type-1 design [2][4].
- **Aggregation asymptotics.** With branching factor `k` and `N` chunks, total prover work is `Θ(N · C_chunk + (N/k) · C_agg + ...)` — dominated by the leaves — while verifier work and proof size are `O(1)`; recursion depth adds only logarithmic latency to the critical path [6][7].
- **Equivalence evidence.** Scroll's zkEVM and the PSE circuits pass the Ethereum execution-spec test suites (the standard differential oracle for equivalence), and Taiko's Type-1 design inherits the same chip-and-lookup architecture [4][5].

## 6 Limitations

1. **SRS row ceiling.** KZG requires a trusted setup whose SRS size bounds the maximum rows per circuit (`2^k` for the largest supported `k`); chunks must fit, and the setup ceremony is a trust assumption no transparent alternative (e.g., FRI) fully escapes without larger proofs [1][3].
2. **Cross-circuit lookup soundness.** Dynamic lookups compose soundness across chips: a single under-constrained table (e.g., a Keccak chip that fails to constrain all 24 rounds) silently voids every dependent proof. Auditing the *interfaces*, not just the gates, is the critical review surface [2][4].
3. **Recursion overhead.** Non-native field arithmetic in the aggregation circuit inflates its row count by an order of magnitude relative to the inner verifier's native cost; poor cycle selection can make aggregation the prover bottleneck rather than the leaves [6].
4. **Equivalence ≠ completeness.** Passing execution-spec tests demonstrates differential equivalence on tested traces, not a proof that the circuit implements the Yellow Paper semantics for all inputs; the gap between "tested equivalent" and "provably equivalent" remains open [5].
5. **Prover economics.** Real-time proving (sub-12-second block proofs) demands GPU/FPGA acceleration and large RAM; the design is sound but not yet cheap, which is why L1 zkEVM roadmaps emphasize prover marketplaces and hardware co-design.

## 7 Conclusion

Ethereum-equivalent proving is achieved not by one clever circuit but by a disciplined *separation of concerns*: Plonkish arithmetization supplies the expressive constraint language [3]; chip decomposition localizes each EVM subsystem's complexity [4]; lookup arguments let expensive primitives like Keccak-256 be proved once and referenced everywhere [2]; and recursive aggregation compresses arbitrarily large executions into a single L1-verifiable proof [6][7]. The result is a Type-1 zkEVM: unmodified bytecode in, succinct validity proof out. The frontier is now formal verification of the chip interfaces themselves — closing the gap between tested equivalence and proven equivalence — and driving prover latency toward real-time block production.

---

## References

[1] Ariel Gabizon, Zachary J. Williamson, Oana Ciobotaru. *PLONK: Permutations over Lagrange-bases for Oecumenical Noninteractive arguments of Knowledge.* IACR Cryptology ePrint Archive, Report 2019/953. https://eprint.iacr.org/2019/953

[2] Ariel Gabizon, Zachary J. Williamson, Oana Ciobotaru. *plookup: A simplified polynomial protocol for lookup tables.* IACR Cryptology ePrint Archive, Report 2020/315. https://eprint.iacr.org/2020/315

[3] Zcash. *The Halo2 Book: Arithmetization — Custom gates, lookup arguments, and the permutation argument.* https://zcash.github.io/halo2/concepts/arithmetization.html

[4] Privacy & Scaling Explorations, Ethereum Foundation. *zkevm-circuits: EVM, State, Keccak, Bytecode, Tx and MPT circuits in Halo2.* https://github.com/privacy-scaling-explorations/zkevm-circuits

[5] Scroll. *Scroll zkEVM Documentation: architecture and Ethereum equivalence.* https://docs.scroll.io/en/learn/zkEVM/

[6] Privacy & Scaling Explorations / privacy-ethereum. *zkEVM notes: Aggregation — chunking, recursion and cross-proof lookups.* https://github.com/privacy-ethereum/zkevm-notes/blob/HEAD/zkEVM%20-%20Aggregation.md

[7] Polygon Zero / Polygon zkEVM tech docs. *Recursion, aggregation and composition of proofs.* https://github.com/0xPolygon/zkevm-techdocs/blob/main/docs/proof-recursion.pdf
