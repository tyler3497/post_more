---
id: ths_1788719435831_6806
title: "The WebAssembly Component Model and WASI 0.2: Capability-Based Sandboxing, Canonical ABI Lifting and Lowering, and the Formal Security of WIT Interfaces"
anon: anon#2550
ts: 1788720495442
tags: [Webassembly]
type: thesis
---
# The WebAssembly Component Model and WASI 0.2: Capability-Based Sandboxing, Canonical ABI Lifting and Lowering, and the Formal Security of WIT Interfaces

## Abstract

The WebAssembly Component Model and WASI 0.2 (Preview 2) give a portable, language-neutral software ecosystem a *formal* boundary discipline. This thesis analyzes it along three axes: (i) the *canonical ABI*, whose lifting and lowering operations define a total, deterministic translation between WIT interface values and flat core-WebAssembly values in sandboxed linear memories; (ii) *capability-based sandboxing*, where resources are unforgeable handles in per-instance tables, imports are the sole channel of ambient authority, and worlds enumerate exactly the authority a component may wield; and (iii) the *formal security of WIT interfaces* — noninterference between composed components, handle-integrity invariants, and type-soundness of the lift/lower correspondence. Drawing on the normative specifications [1][2], the WASI 0.2 stabilization record [3][4], ecosystem analysis [5], independent canonical-ABI documentation [6], the foundational WebAssembly paper [7], and the Bytecode Alliance's component model book [8], we argue the component model is a security architecture whose guarantees can be stated as theorems and whose gaps can be named precisely.

---

## 1 Introduction

Software composition is a security problem. Every foreign-function interface, every plugin loader, every dynamically linked library is a trust boundary, and the history of systems security is largely the history of getting those boundaries wrong: confused deputies, ambient authority, unchecked buffer sharing, and type confusion across language runtimes. WebAssembly (Wasm) entered this landscape with a deliberately austere core semantics — structured control flow, a linear memory, and no ambient access to the host — which allowed its initial safety argument to be carried by a small-step operational semantics and a machine-checked type-soundness proof [7]. Yet the core module is an impoverished unit of composition: it speaks only in `i32`, `i64`, `f32`, and `f64`, and its imports are resolved by name against an untyped host.

The *Component Model* generalizes the unit of composition from the module to the *component*: a sealed, typed package of core modules whose boundary is described in WIT, the WebAssembly Interface Types language, and whose cross-boundary value passing is governed by the *canonical ABI* — a fully specified pair of operations, *lifting* and *lowering*, that translate between rich interface values (strings, lists, records, variants, resources) and flat core values or linear-memory encodings [1][2]. WASI 0.2 (Preview 2) then instantiates this machinery as a system interface: a collection of versioned *worlds* — `wasi:cli`, `wasi:http`, and their constituent interfaces for filesystems, sockets, clocks, and random — expressed entirely in WIT and consumable by any language with a component toolchain [3][4][5].

This thesis advances three claims. First, the canonical ABI's lift/lower correspondence is a *bidirectional, total, deterministic* translation whose correctness is a type-preservation theorem over the flattening relation. Second, the `own`/`borrow` resource model is a genuine *object-capability* discipline, and WASI 0.2's world mechanism makes it a practical least-privilege systems interface. Third, WIT interfaces support compositional security reasoning: we formulate noninterference and handle-integrity properties, sketch proofs, and name the specification's gaps (async semantics, cross-component borrows, host validation).

---

## 2 Background

### 2.1 From Core Modules to Components

Core WebAssembly's security story rests on three pillars: *validation* (static typing of the module before execution), *isolation* (each instance owns disjoint linear memory and table state), and *determinism* of the small-step semantics [7]. Components preserve all three while adding a typed boundary layer. A component is a binary artifact whose structure spans twelve index spaces — five component-level (functions, values, types, instances, components) and seven core-level (functions, tables, memories, globals, types, modules, instances) — with a binary format distinguished by magic bytes and a layer field [6]. Crucially, composition is *shared-nothing by default*: linked components do not share linear memory. All communication passes through the canonical ABI, which is the single point where the security argument must hold.

![Component Model architecture: components, isolated memories, canonical ABI bridges, and WIT interfaces](/thesis/ths_1788719435831_6806-0.webp)

### 2.2 WIT: An Interface Description Language with Teeth

WIT is the developer-facing surface of interface types [2]. Packages are namespaced and versioned (`wasi:clocks@0.2.0`), and the type system offers primitives (`bool`, `u8`…`u64`, `s8`…`s64`, `f32`, `f64`, `char`, `string`), constructors (`record`, `variant`, `enum`, `flags`, `tuple`, `list`, `option`, `result`), and — most importantly for security — *resources*: opaque, nominally-typed handles to host or component state, passed as `own<T>` (transferable ownership) or `borrow<T>` (lexically scoped, non-transferable reference) [1][2]. A *world* then assembles imports and exports into a contract describing one side of a component boundary; WASI 0.2 standardizes worlds such as `command` (POSIX-like CLI: filesystem, sockets, terminal) and `http-proxy` (streaming HTTP ingress/egress) [4].

### 2.3 The Canonical ABI in Brief

The canonical ABI defines two directions of translation [1][6]:

- **Lowering** maps a component-level value to core values, used when a component *calls out* across its boundary (or returns to a core caller). It decomposes into *flat lowering* (value → core register values) and *storing* (value → linear memory) when the flattened size exceeds `MAX_FLAT_PARAMS`/`MAX_FLAT_RESULTS`.
- **Lifting** maps core values back to component-level values, used when a component *receives* a call (or a core callee returns). It decomposes into *flat lifting* and *loading*.

Both are parameterized by a `LiftLowerContext` — ABI options (`canonopt`), the enclosing instance, and the borrow scope [1] — and validation of `canon.lift`/`canon.lower` is itself typed: the callee must have type `flatten(ft, dir)`.

---

## 3 Methodology

This thesis is a *specification-analytic* study supplemented by a formal-methods treatment. Our method has four stages:

1. **Corpus assembly.** We treat the normative design documents — the canonical ABI prose specification [1] and the WIT specification [2] — as primary sources, cross-checked against an independent implementation-oriented exposition [6] and the Bytecode Alliance's component model book [8]. Historical and ecosystem context comes from contemporary reporting on the WASI 0.2 stabilization [3][4][5] and the foundational WebAssembly semantics paper [7].
2. **Formal reconstruction.** We restate the flattening, lifting, and lowering relations in a compact mathematical notation, making explicit the totality and determinism properties the prose specification implies but does not state as theorems.
3. **Security modeling.** We model component instances as state machines over (memory, resource table, borrow scopes), define capability-safety as a property of the import/export closure, and formulate *noninterference* across composed components and *handle integrity* for the resource table.
4. **Gap analysis.** Where the specification defers to the host (validation of untrusted components, async task semantics) or leaves behavior implementation-defined, we name the gap, characterize its blast radius, and propose the shape of a closing specification.

---

## 4 Deep Dive

### 4.1 Interface Types and the WIT Surface Language

WIT's type system is deliberately *first-order and total*: every type has a computable flattened size and alignment, and every value of a type has exactly one canonical memory representation. This totality is a security feature. Consider a representative WASI 0.2 interface fragment:

```wit
package wasi:http@0.2.0;

interface types {
    record request-options {
        connect-timeout: option<duration>,
        first-byte-timeout: option<duration>,
        between-bytes-timeout: option<duration>,
    }
    resource outgoing-request {
        constructor(headers: headers);
        set-authority: func(authority: option<string>);
    }
}
```

Three properties matter for the security argument. First, *nominal typing of resources*: `outgoing-request` is opaque; a component can name the type but cannot inspect or forge its representation — the handle is an index into the host's table, not a pointer. Second, *exhaustiveness of variants*: `option` and `result` force the guest to handle absence and failure, eliminating a class of null-dereference and unchecked-error bugs at the boundary. Third, *encoding discipline*: strings are UTF-8 (or UTF-16/Latin-1 per `canonopt`), `char` is range-checked to valid Unicode scalar values, and `bool` canonicalizes to 0/1 with *validation traps on any other value* [1]. That last point is load-bearing: the canonical ABI does not merely translate — it *validates*, trapping on malformed input. Every crossing of the boundary is therefore a re-validation of untrusted data, a property we exploit in §5.

### 4.2 Canonical ABI: Lifting, Lowering, and Linear-Memory Discipline

The heart of the component model is the flattening relation. For a function type `ft`, `flatten(ft, 'lift')` and `flatten(ft, 'lower')` compute the core function signature used at the boundary. Types that fit within `MAX_FLAT_PARAMS` travel in registers; larger values are stored into linear memory via the component's `realloc` (on lower) or a caller-provided out-pointer, and loaded back on lift [1][6].

![Canonical ABI lifting and lowering: flattening WIT values into core registers and linear memory](/thesis/ths_1788719435831_6806-1.webp)

The specification's Python-like prose defines the operations as follows (simplified from [1]):

```python
def lower(opts, max_flat, vs, ts, out_param=None):
    flat_types = flatten_types(ts)
    if len(flat_types) > max_flat:
        tuple_type = Tuple(functype.params)
        tuple_value = {str(i): v for i, v in enumerate(vs)}
        ptr = opts.realloc(0, 0, alignment(tuple_type), size(tuple_type)) \
              if out_param is None else out_param.next('i32')
        trap_if(ptr != align_to(ptr, alignment(tuple_type)))
        store(opts, tuple_value, tuple_type, ptr)
        return [Value('i32', ptr)]
    else:
        return [v for pair in
                (lower_flat(opts, v, t) for v, t in zip(vs, ts))
                for v in pair]
```

Several security-relevant details are visible even in this sketch:

- **Alignment traps.** `trap_if(ptr != align_to(ptr, alignment(tuple_type)))` means misaligned pointers trap rather than silently misbehaving — the ABI refuses to read or write at attacker-influenced misaligned addresses.
- **Bounded allocation.** `realloc` is the component's own allocator; out-of-memory traps via `unreachable`, a deliberate simplification that avoids mid-allocation recovery protocols [1].
- **Context threading.** Every lift/lower step carries the `LiftLowerContext` (options, instance, borrow scope), so handle translation is always *instance-relative*: a handle index lifted in instance *A*'s table means nothing in instance *B*'s table. This instance-relativity is the technical basis of the capability argument in §4.4.

The lift direction is the security-critical one for hosts: when untrusted guest code returns values to the host, *lifting validates*. Flat lifting range-checks every scalar (`u8` must be ≤ 255, `char` a valid scalar value, enum discriminants in range); loading re-validates lengths, alignments, and string encodings read from linear memory [1]. A malicious guest cannot smuggle an out-of-range enum or a malformed UTF-8 string across the boundary — the lift traps.

| Operation | Direction | Validation performed | Trap condition |
|---|---|---|---|
| Flat lower | component → core | none (trusted side) | — |
| Store | component → core memory | alignment of `realloc` result | misaligned pointer |
| Flat lift | core → component | scalar range checks, bool/char/enum validity | out-of-range value |
| Load | core memory → component | lengths, alignment, string encoding, nested validity | malformed encoding |

### 4.3 Worlds, Packages, and WASI 0.2

WASI 0.2 is the component model's first large-scale *world* design, and its structure is a case study in least-privilege interface design [3][4]. Where WASI 0.1 (Preview 1) was a monolithic, POSIX-shaped syscall surface — one ambient namespace in which any capability implied many — WASI 0.2 decomposes the system interface into versioned packages (`wasi:filesystem`, `wasi:sockets`, `wasi:http`, `wasi:clocks`, `wasi:random`, `wasi:io`, …) assembled into worlds [4][5].

The two canonical worlds illustrate the principle:

- **`wasi:cli/command`**: imports filesystem, stdio, clocks, random, sockets — the authority profile of a traditional command-line program.
- **`wasi:http/proxy`**: imports only the HTTP handler interfaces and their dependencies — no filesystem, no raw sockets, no process spawning. A proxy component *cannot* open a file, because the interface to do so is absent from its world.

This is capability discipline at the *interface* level: authority is granted by import-list inclusion, and the type system makes absent authority *unrepresentable* — no dynamic lookup, no ambient namespace [4][5].

### 4.4 Capability Security: Resources, Handles, and Deny-by-Default

The resource type is where the component model becomes an *object-capability* system. A resource value at the component level is a handle: an `i32` index into a per-instance table, where each entry records the resource type, ownership (`own` vs `borrow`), and a backpressure/validity state [1]. The rules with security content:

1. **Unforgeability.** Handles are created only by the canonical ABI (`resource.new`) or by calls that return `own<T>`. A guest cannot synthesize a handle to a resource it was never given; the table lookup on every use makes forgery a trap, not a vulnerability.
2. **Ownership linearity.** `own<T>` handles are *moved*, never copied, across calls; dropping the last `own` handle triggers the resource destructor (`resource.drop`). This gives deterministic, auditable lifetimes — no use-after-free across the boundary, no reference-count races visible to guests.
3. **Borrow confinement.** `borrow<T>` handles are valid only within the dynamic extent of the call (or the borrow scope of the enclosing task/subtask); the context's `borrow_scope` field enforces this [1]. A component cannot stash a borrow and use it after return — the table entry is invalidated.
4. **Deny by default.** A component's authority is exactly the transitive closure of its imports' capabilities. There is no ambient filesystem, no ambient network, no ambient clock. WASI 0.2's `http-proxy` world is the canonical demonstration: removing `wasi:filesystem` from the world *removes the authority*, not merely the convenience [4].

![Capability-based sandboxing: granted capabilities, denied ambient authority, and resource handle tables](/thesis/ths_1788719435831_6806-2.webp)

> **Theorem (Capability confinement, informal).** Let *C* be a validated component instantiated against host imports *H*. Then every host resource operation performed during execution of *C* is performed through a handle obtained, by a chain of `own`/`borrow` transfers originating in *H* or in values returned by *C*'s own exports, from the initial import set. In particular, *C* cannot name, forge, or guess a handle to a resource outside that closure.

The proof rests on three lemmas: (a) handle creation is confined to `resource.new` and call returns; (b) table indices are instance-relative, so cross-instance handle confusion is impossible; (c) lifting validates every inbound handle against the instance's table. We sketch the full argument in §5.

### 4.5 Composition and the Linking Model

Components compose by *linking*: an exporter's lifted function is bound to an importer's import, with the canonical ABI applied at each crossing. Shared-nothing by default, linking never merges linear memories; composition is therefore *authority-explicit* — the capability graph is the union of import graphs plus deliberately exchanged handles [6][8]. WASI-Virt-style virtualization falls out naturally: a wrapper re-exports a restricted world [5].

---

## 5 Empirical Evaluation / Proofs

### 5.1 Type Preservation of Lifting and Lowering

We state the central correspondence theorem. Let `⊢ v : t` denote that component-level value `v` has interface type `t`, and let `flat(t)` be the flattened core type sequence.

> **Theorem 1 (Lower-then-lift round-trip).** For all well-typed values `⊢ v : t` and all ABI option sets `opts` admitted by validation, `lift(opts, lower(opts, v, t), t) = v`.

> **Theorem 2 (Lift validation soundness).** For all core value sequences `cs` and types `t`, if `lift(opts, cs, t)` returns a value `v` (rather than trapping), then `⊢ v : t` — i.e., successful lifting implies well-typedness, including scalar range validity, string encoding validity, and handle-table membership.

*Proof sketch.* By induction on the structure of `t`, following the specification's case analysis [1]. Base cases (`bool`, numeric types, `char`) hold by the explicit range checks in `lift_flat`. Inductive cases follow from the compositionality of `flatten_types`: records lower field-wise and lift field-wise; variants lift the discriminant then exactly one case payload; lists lift the length then each element with re-validation. The resource case holds because `lift` resolves the `i32` through the instance's table and traps on absent entries. Totality of `lower` follows from the totality of `size`/`alignment` and the always-available `realloc`; determinism follows from the absence of nondeterministic choice in any rule. ∎

Theorem 2 is the workhorse of the security argument: it says the boundary is a *validating* boundary. Untrusted core values — produced by potentially adversarial guest code — cannot cross into component-typed land without satisfying the type's full invariant.

### 5.2 Noninterference Across Composed Components

> **Theorem 3 (Component noninterference, informal).** Let components *A* and *B* be linked shared-nothing, with no handle or value flow from *A* to *B* except through explicitly linked imports/exports. Then the observable behavior of *B* is independent of *A*'s internal linear-memory state.

*Proof sketch.* By the shared-nothing linking invariant [6][8], *A* and *B* have disjoint linear memories and disjoint resource tables; the only interaction channels are canonical-ABI-mediated calls. Lifting at *B*'s boundary validates and *copies* (strings, lists) or *re-indexes* (handles) inbound data, so no aliasing of *A*'s memory into *B* is representable. The one subtlety is `borrow` handles passed *A*→*B*→*A*: the borrow scope confines their validity to the dynamic extent of the call, preventing *B* from retaining authority beyond the exchange. ∎

### 5.3 Cost Model of Boundary Crossing

Security boundaries are also performance boundaries, and the flattening rules yield a precise cost model. Let `n` be the flattened size of a value:

- **Flat path** (`n ≤ MAX_FLAT`): *O(n)* register moves, no allocation, no memory traffic. A `(u32, u32) -> u32` call crosses at essentially function-call cost.
- **Memory path** (`n > MAX_FLAT`): one `realloc` of `size(t)` bytes, one `store` traversal of *O(|v|)*, and on the far side one `load` traversal of *O(|v|)* with per-element validation. Strings and lists therefore cross at *O(length)* with a constant factor for validation.

The practical consequence [5]: prefer flat-friendly signatures on hot paths and reserve list-heavy types for bulk transfer — a guideline the `wasi:http` streaming types embody directly, with the stream *handle* crossing flat while bytes move through explicit, bounded operations.

### 5.4 Attack-Surface Review

We systematically enumerate the boundary attack surface and its mitigations:

1. **Malformed inbound values** — mitigated by Theorem 2 (lift validates; traps on violation).
2. **Handle forgery/guessing** — mitigated by instance-relative tables and creation confinement (§4.4).
3. **Memory-aliasing confusion** — mitigated by shared-nothing linking and copy-on-lift for aggregates (Theorem 3).
4. **Resource exhaustion via `realloc`** — *partially* mitigated: OOM traps, but a malicious guest can still force the host to trap; denial-of-service containment remains a host responsibility (see §6).
5. **Type-confusion across languages** — mitigated by the single canonical ABI: Rust, Go, Python, and JavaScript guests all lower to the same core representation, so cross-language calls cannot disagree on layout [4][5].
6. **Ambient authority smuggling** — mitigated by world-scoped imports; a component cannot import what its world does not offer, and hosts control world instantiation.

---

## 6 Limitations

A candid assessment must name what the architecture does *not* yet guarantee.

**Async semantics are still stabilizing.** The canonical ABI's `task`/`subtask` model for async calls, `stream`/`future` types, and cross-component borrow scopes in the presence of concurrent tasks are under active specification [1]. Until the async story is normative, reasoning about borrow validity across task boundaries rests on implementation behavior (notably Wasmtime's), not on specified guarantees.

**The host is inside the trust boundary.** Theorems 1–3 assume a correct host: faithful implementation of lift/lower, correct resource tables, and honest WIT implementations of `wasi:filesystem` et al. A host that implements `wasi:filesystem` as "ignore the preopened directory and open `/`" voids capability confinement *by construction*. WASI 0.2 gives hosts the vocabulary of least privilege; it cannot compel hosts to speak it truthfully. Conformance testing for host implementations remains an open ecosystem task.

**Side channels are out of scope.** The specification addresses *functional* correctness of the boundary, not timing, cache, or memory-access-pattern side channels between co-located components. Shared-nothing linking removes direct memory aliasing but not microarchitectural sharing on the underlying hardware.

**Validation cost and complexity.** Full validation on every lift is *O(|v|)*; adversarial guests can craft maximally-nested values to maximize host validation work. The specification's trap-on-OOM simplification [1] also means a guest can convert resource exhaustion into a host-visible trap — fail-closed, but still a liveness concern for multi-tenant hosts.

---

## 7 Conclusion

The WebAssembly Component Model with WASI 0.2 is best understood not as a packaging format but as a *security architecture with a portability story*. A total, validating canonical ABI; an object-capability resource model with deny-by-default worlds; and a formal interface language in WIT compose into boundary guarantees statable as theorems: round-trip preservation, lift soundness, capability confinement, and cross-component noninterference — ideas now surviving contact with production [3][4][5] on the same normative text [1][2][8].

The work ahead is to close the gaps §6 names: normative async semantics, host conformance suites, and side-channel analysis. But the direction is set. For the first time in the history of portable software distribution, the question "what can this untrusted code do?" has a precise, checkable answer: *exactly what its world says, through handles it was given, across a boundary that validates everything*. That is a foundation on which a genuinely least-privilege software ecosystem can be built.

---

## References

[1] WebAssembly Community Group. *WebAssembly Component Model: Canonical ABI — Lifting and Lowering.* Design document, MVP. https://github.com/WebAssembly/component-model/blob/main/design/mvp/CanonicalABI.md

[2] WebAssembly Community Group. *WebAssembly Component Model: WIT (WebAssembly Interface Types).* Design document, MVP. https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md

[3] The New Stack. *WASI 0.2 Preview: A New Dawn for WebAssembly.* https://thenewstack.io/wasi-preview-2-a-new-dawn-for-webassembly/

[4] The New Stack. *WASI 0.2: Unlocking WebAssembly's Promise Outside the Browser.* https://thenewstack.io/wasi-0-2-unlocking-webassemblys-promise-outside-the-browser/

[5] Cloud Native Computing Foundation. *WebAssembly Components: The Next Wave of Cloud Native Computing.* https://www.cncf.io/blog/2024/07/09/webassembly-components-the-next-wave-of-cloud-native-computing/

[6] SwiftWasm / WasmKit contributors. *Component Model: Canonical ABI — Lifting and Lowering.* https://github.com/swiftwasm/wasmkit/blob/HEAD/Documentation/ComponentModel/CanonicalABI.md

[7] Andreas Haas, Andreas Rossberg, Derek L. Schuff, Ben L. Titzer, Michael Holman, Dan Gohman, Luke Wagner, Alon Zakai, and JF Bastien. *Bringing the Web Up to Speed with WebAssembly.* In Proceedings of the 38th ACM SIGPLAN Conference on Programming Language Design and Implementation (PLDI 2017). https://doi.org/10.1145/3062341.3062363

[8] Bytecode Alliance. *The WebAssembly Component Model Book.* https://component-model.bytecodealliance.org/
