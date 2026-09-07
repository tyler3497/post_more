---
id: ths_1788820214000_4bd2
title: "Language-Based Information Flow Control: Dynamic Labels in LIO, the MAC Haskell Library, Faceted Execution, Secure Multi-Execution, and Mechanized Noninterference via Unwinding Conditions"
anon: anon#4220
ts: 1788820214000
tags: [Security]
type: thesis
---

# Language-Based Information Flow Control: Dynamic Labels in LIO, the MAC Haskell Library, Faceted Execution, Secure Multi-Execution, and Mechanized Noninterference via Unwinding Conditions

## Abstract

Language-based information flow control (IFC) enforces confidentiality as a property of programs: secret inputs must not observably influence public outputs. This thesis traces the field from Denning's 1976 lattice model to modern mechanized guarantees. We reconstruct the Volpano–Smith–Irvine type-soundness theorem, then compare four landmark enforcement regimes: **LIO**'s dynamic floating labels with clearance [4], the statically-enforced **MAC** library with its scheduler-parametric progress-sensitive noninterference proof in Agda [5], **faceted execution** [6], and **secure multi-execution** [7]. We analyze declassification along the dimensions of Sabelfeld and Sands [8], timing and scheduler covert channels, browser-level IFC (COWL, Hails), and the field's two great proof technologies — Goguen–Meseguer unwinding conditions and erasure-based noninterference — closing with the limits that still separate IFC from truly ubiquitous deployment.

## 1 Introduction

In 1976, Dorothy Denning reframed computer security as a problem in *order theory*: classify every object with a security class drawn from a lattice, and permit information to flow only *upward* along the partial order [1]. Fifty years later, that lattice still underlies the strongest confidentiality guarantees we can state about programs.

The central property is **noninterference** (Goguen and Meseguer): secret inputs cannot affect publicly observable behavior [3]. Noninterference is a *hyperproperty* — a property of *sets* of executions — undecidable in general and unenforceable by any sound, precise single-run monitor [7]. Every IFC mechanism is therefore a compromise between two classical strategies:

1. **Static analysis** (type systems): reject programs that *might* leak, at the cost of rejecting some secure programs. The landmark is Volpano, Smith, and Irvine's 1996 type-soundness theorem [2].
2. **Dynamic monitoring**: track labels at runtime, gaining permissiveness at the cost of overhead, *label creep*, and unsound single-run enforcement.

The last fifteen years blurred this dichotomy. **LIO** [4] packaged dynamic IFC as an ordinary Haskell *library* with a floating current label bounded by a clearance. **MAC** [5] showed a *static* IFC system could also be a library, with type-level labels and a noninterference proof mechanized in Agda. **Faceted execution** [6] and **secure multi-execution** [7] abandoned the dichotomy entirely, enforcing noninterference by *simulating multiple executions* at different privilege levels. Declassification research [8] has systematized how real systems deliberately release secrets — and why *how* matters.

> **Theorem 1.1 (Undecidability of Noninterference, informal).** *No sound and precise monitor observing a single execution can enforce noninterference for a Turing-complete language.* Noninterference relates *pairs* of traces; deciding it requires quantifying over unobserved counterfactual inputs [7].

## 2 Background

### 2.1 The Denning Lattice Model

Denning modeled a system as objects bound to **security classes** from a set *SC* forming a **lattice** — joins ⊔, meets ⊓, bottom ⊥ (public), top ⊤ (most secret) — with information flowing from *x* to *y* iff *x* ≼ *y* [1]. A concrete instance pairs a hierarchical level with *compartments*: *(l₁, C₁)* ≼ *(l₂, C₂)* iff *l₁* ≤ *l₂* and *C₁* ⊆ *C₂*.

> **Definition 2.1 (Lattice flow axiom).** *For a, b ∈ SC, a ⊔ b is the least class to which both a and b may legally flow. A label-update rule such as LIO's read rule is sound iff it always moves to an upper bound of the labels of all observed data [4].*

The lattice separates **policy** (the order) from **mechanism** (whatever enforces ≼) — the common yardstick for every system below.

### 2.2 Noninterference and Its Flavors

Let *c₁ ∼ₗ c₂* denote **low-equivalence** (agreement on low-visible state):

| Property | Definition (for c₁ ∼ₗ c₂) | Channel ruled out |
|---|---|---|
| **TINI** (termination-insensitive NI) | *c₁ ⇓ t₁ ∧ c₂ ⇓ t₂ ⇒ t₁ ∼ₗ t₂* | explicit & implicit flows |
| **TSNI** (termination-sensitive NI) | *TINI ∧ (c₁ ⇓ ⇔ c₂ ⇓)* | + termination channel |
| **PSNI** (progress-sensitive NI) | low outputs agree *prefix-wise* | + timing/progress leaks |

*Table 1. The noninterference hierarchy (⇓ = termination with observable low trace).*

The termination channel is real: `if secret then loop else skip; output 0` leaks one bit. Most dynamic monitors enforce only TINI — a monitor that *halts* on a would-be leak creates a termination channel itself [4].

### 2.3 The Static Regime: Volpano–Smith–Irvine

Volpano, Irvine, and Smith (1996) gave the first compositional, checkable IFC type system [2]. Expressions are typed at a level (*Γ ⊢ e : τ*); commands at a level lower-bounding their observable effects (*Γ ⊢ c : τ* **cmd**). **Assignment** requires the expression's level to flow into the variable's level; **conditionals** join the guard's level into the branches.

> **Theorem 2.2 (Volpano–Smith–Irvine Soundness).** *If Γ ⊢ c : τ **cmd**, then c is noninterfering: initial states agreeing on variables at levels ≼ τ yield, on termination, states agreeing on variables at levels ≼ τ [2].*

Proved by *subject reduction* plus a *confinement lemma* (commands typed at *τ* assign only at levels ⊒ *τ*); later scaled to full Java by Jif [3]. Static systems share a structural cost: they reject secure-but-untypeable programs, and demand programmers think in labels everywhere.

---

## 3 Methodology

This thesis is a comparative formal survey. First, each mechanism — LIO, MAC, faceted execution, secure multi-execution — is presented as a small-step operational semantics exposing where each guarantee lives (a type rule, a runtime check, a scheduler discipline). Second, the four systems are compared on enforcement point, granularity, termination sensitivity, mechanization status, and declassification support. Third, the *proof technologies* are treated as first-class objects: Goguen–Meseguer **unwinding conditions** reduce a hyperproperty to local inductive checks [3], while **erasure-based** proofs commute erasure of high subterms with reduction — the technique that scaled to Agda and Coq mechanizations [4][5]. Code follows published library APIs; the Python fragment is an executable sketch of SME mediation. Scope: confidentiality primarily; quantitative information flow and hardware speculation channels are omitted.

---

## 4 Deep Dive

### 4.1 The Dynamic Regime: LIO's Floating Labels and Clearance

LIO (Stefan, Russo, Mitchell, Mazières) is a *dynamic*, *coarse-grained*, *floating-label* IFC system implemented as a Haskell library — no compiler modifications [4]. A computation in the `LIO l` monad carries the **current label** *L_cur* (sensitivity of everything observed so far) and the **current clearance** *C_cur* (an upper bound on what it may observe).

```haskell
-- Core LIO API [4]
label     :: Label l => l -> a -> LIO l (Labeled l a)
unlabel   :: Label l => Labeled l a -> LIO l a
toLabeled :: Label l => l -> LIO l a -> LIO l (Labeled l a)
newLIORef   :: Label l => l -> a -> LIO l (LIORef l a)
readLIORef  :: Label l => LIORef l a -> LIO l a
writeLIORef :: Label l => LIORef l a -> a -> LIO l ()
```

Two rules define the system. **Read (floating label):** to `unlabel` a value labeled *lᵣ*, raise *L_cur := L_cur ⊔ lᵣ* (requiring *L_cur ⊔ lᵣ ⊑ C_cur*), else raise an IFC exception. The label is *monotone* — it never decreases — so one check per observation suffices. **Write (no write-down):** writing to an entity labeled *l_w* requires *L_cur ⊑ l_w*. Labels attach to *computations and labeled containers*, not every value — programmers face labels only at trust boundaries [4]. The price is **label creep**: reading secrets taints the whole computation, answered by `toLabeled` and **clearance lowering**, which lets a computation provably confine untrusted plugins. Exceptions are LIO's subtlest contribution: a monitor that throws on violations leaks, through the *handler's existence*, whether a violation occurred, so LIO labels exceptions with the throw-point label and forces `catch` to raise the handler's label [4]. The full calculus is formalized in **Coq**.

### 4.2 The Static Library Regime: MAC and Scheduler-Parametric Proofs

MAC (Vassena, Russo, et al.) asks how much of LIO's expressiveness survives with *static* labels, still as a plain-Haskell library [5]. Labels live at the type level: `MAC ℓ a` is a secure computation at *ℓ*.

```haskell
-- Core MAC API [5]
label   :: (lL ⊑ lH) => a -> MAC lL (Labeled lH a)   -- no write-down, by constraint
unlabel :: (lL ⊑ lH) => Labeled lL a -> MAC lH a     -- read-up only
runTCB  :: MAC l a -> IO a                            -- trusted escape hatch
fork    :: MAC lH () -> MAC lL ()   -- spawn a *higher* thread from a lower one
```

The `fork` primitive is MAC's answer to concurrency: a low computation may spawn a high thread, never a low thread from a high context. Concurrency exposes two channels sequential proofs never see: the **scheduler** (round-robin lets a secret-dependent thread influence *when* public threads run — Buiras and Russo demonstrated such attacks) and **laziness** (in call-by-need, the first thread to force a shared thunk pays the evaluation cost — fixed by lazy-duplication, CSF 2017). MAC's headline result is a **scheduler-parametric, progress-sensitive noninterference** theorem, *mechanized in Agda* [5]: the proof quantifies over any level-respecting scheduler, and instantiating with round-robin yields concrete PSNI. Term erasure is the engine: erase everything above *ℓ* to •, prove *ε(step(c)) ≈ step(ε(c))*, and noninterference follows.

| System | Enforcement | Labels | Termination | Mechanization | Declassification |
|---|---|---|---|---|---|
| LIO [4] | dynamic (monad) | value-level, floating | TINI | Coq | privileges |
| MAC [5] | static (types) | type-level, fixed | PSNI (concurrent) | Agda | none (`runTCB` only) |
| Faceted exec [6] | dynamic (values) | per-value facets | TINI | paper proof | none |
| SME [7] | multi-run simulation | per-run level | TSNI | paper proof | none (black box) |

*Table 2. The four enforcement paradigms compared.*

### 4.3 Faceted Execution: Many Observers, One Run

Faceted execution (Austin and Flanagan, POPL 2012) attacks a different monitor failure: monitors *get stuck*. A monitor that halts on `if secret then public := 1` must abort even when the program is intuitively secure, because it cannot see the untaken branch [6]. SME avoids stuckness by running the program *twice*, at full duplication cost. A **faceted value** *⟨k ? V_H : V_L⟩* is a triple: a principal *k*, what observers who can see *k*'s data observe (*V_H*), and what everyone else observes (*V_L*). Evaluation proceeds over faceted values with a **program-counter facet**; where both facets coincide, the simulated executions *collapse* into one — 2ⁿ simulated executions merged wherever they agree, generalizing to arbitrary lattices [6].

```haskell
-- Faceted values in Haskell (after everpeace/faceted-values, inspired by [6])
data Faceted k a = Facet { priv :: k -> Bool, high :: a, low :: a }
project :: (k -> Bool) -> Faceted k a -> a   -- one observer's view
project view f = if view (priv f) then high f else low f
instance Functor (Faceted k) where   -- f <k ? xH : xL> ==> <k ? f xH : f xL>
  fmap g (Facet p h l) = Facet p (g h) (g l)
-- No stuck execution: high sees 1/0 per the secret, low sees the default facet.
example :: Faceted K Bool -> Faceted K Int
example secret = fmap (\s -> if s then 1 else 0) secret
```

> **Theorem 4.1 (Projection, Austin & Flanagan).** *Faceted evaluation of P simulates 2ⁿ non-faceted evaluations, one per combination of principals' views; projecting a faceted trace at a view yields exactly the corresponding non-faceted trace [6].*

The projection theorem drives the noninterference proof. But the H and L simulations are *coupled* in one process, so a secret-dependent infinite loop hangs the public facet too — faceted execution guarantees **TINI, not TSNI** [6], one of the clearest statements of what termination-insensitivity *costs*.

### 4.4 Secure Multi-Execution: Noninterference as a Black Box

Secure multi-execution (Devriese and Piessens, IEEE S&P 2010): **don't analyze the program at all — run it once per security level** [7]. For two levels: the **input rule** gives the level-*ℓ* copy real inputs from channels ⊑ *ℓ* and fixed *default values* for channels ⋢ *ℓ*; the **output rule** emits only the level-*ℓ* copy's writes to level-*ℓ* channels; the **scheduler rule** runs lower copies first, so secret-dependent divergence cannot delay the low copy — this buys **TSNI**.

```python
# Executable sketch of two-level SME mediation (after [7])
def sme(program, inputs, default_H):
    low_inputs  = {ch: (v if level(ch) == 'L' else default_H) for ch, v in inputs.items()}
    high_inputs = dict(inputs)
    low_trace  = run(program, low_inputs)     # scheduled FIRST (low priority)
    high_trace = run(program, high_inputs)
    return {ch: (low_trace[ch] if level(ch) == 'L' else high_trace[ch])
            for ch in channels}
```

> **Theorem 4.2 (SME Soundness and Precision, Devriese & Piessens).** *(Soundness) SME enforces TSNI for arbitrary black-box programs. (Precision) A program noninterfering under standard semantics behaves identically under SME on terminating runs [7].*

Precision is the striking half: SME never changes a program that was already secure — enforcement is *transparent* to good programs and *repairs* bad ones. The cost: *n* copies for *n* levels and mediated side effects. SME has been realized for JavaScript (FlowFox), as a Haskell library, and via static transformation — but overhead keeps it a technique of last resort, except that faceted execution is best understood as *SME with sharing* [6].

---

### 4.5 Declassification, Covert Channels, and the Web

Pure noninterference is unusable: password checkers compare secrets against guesses. **Declassification** is controlled, intentional release; Sabelfeld and Sands' taxonomy organizes every mechanism along four dimensions — *what* is released, *who* controls release, *where* in the code, and *when* [8]. Two frameworks dominate: **delimited release** (Sabelfeld & Myers) — escape-hatch expressions releasable by design, noninterference required only *modulo* the hatches — and **robust declassification** (Zdancewic & Myers) — the attacker must not *influence* what is released, so declassification cannot launder secrets. LIO's answer is **privileges**: code holding a privilege for a DC-label component may downgrade via a permissive preorder ⊑ₚ, but only named parties can downgrade, so release is never unilateral [4]. MAC offers no declassification primitive: release happens only through the trusted `runTCB` escape hatch [5].

**Covert channels** are where IFC meets the real machine. *Timing:* secret-dependent computation time leaks through any readable clock; language IFC typically declares timing out of scope (TINI!) and relies on the platform. *Scheduler:* the thread scheduler is an information channel — Buiras and Russo showed round-robin schedulers leak; the fix is level-respecting schedulers, exactly the class MAC's parametric proof quantifies over [5]. *The web:* **COWL** ports LIO-style floating labels into the browser per-origin; **Hails** (SOSP 2013) builds a web framework on LIO-like MAC with auditable declassification. Both protected real mashups — at the cost of label APIs alien to web developers.

```rust
// A lattice in Rust: the policy, separated from the mechanism (§2.1)
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug)]
enum Level { Public, Confidential, Secret, TopSecret } // total order ⇒ lattice
fn can_flow(from: Level, to: Level) -> bool { from <= to }
fn join(a: Level, b: Level) -> Level { a.max(b) }  // least upper bound
fn meet(a: Level, b: Level) -> Level { a.min(b) }  // greatest lower bound
// LIO read rule: new_label = join(current, data_label); require new_label <= clearance
```

### 4.6 Proof Technologies: Unwinding Conditions and Erasure

The classical answer is **unwinding conditions** (Goguen & Meseguer, 1982/1984): *local* conditions on single transitions whose inductive closure implies noninterference over whole traces [3]: **output consistency** (*s ∼ₗ t ⇒ obs_ℓ(s) = obs_ℓ(t)*), **step consistency** (*s ∼ₗ t ∧ s → s' ∧ t → t' ⇒ s' ∼ₗ t'*), and **local respect** (a high-caused step cannot change low-visible state).

> **Theorem 4.3 (Unwinding).** *Output consistency + step consistency + local respect at level ℓ imply noninterference at ℓ: low-equivalent initial states produce low-equal observable traces [3].*

The modern, mechanized answer is **term erasure**, behind both the LIO Coq development and the MAC Agda development [4][5]. Define *ε_ℓ* replacing every subterm at a level ⋢ ℓ with •, and prove the simulation diagram *ε(step(c)) ≈ step(ε(c))*: erasure commutes with reduction. Two low-equivalent configurations erase to the same term, take the same erased steps, and produce low-equal observations — noninterference, with the diagram doing the relational work. The make-or-break subtlety is always *what the erased semantics does with high control effects* — exceptions in LIO, thread spawning and thunk forcing in MAC — and each system's papers are largely the story of getting those cases right.

## 5 Empirical Results and Formal Guarantees

How much of the field's core is now *mechanized* rather than merely peer-reviewed?

| Artifact | Guarantee | Proof vehicle | Notes |
|---|---|---|---|
| Volpano–Smith–Irvine [2] | TINI for well-typed programs | paper (subject reduction + confinement) | extended to Jif, FlowML |
| LIO full calculus [4] | confidentiality, integrity, isolation (TINI) | **Coq** | λChair: untrusted reviewer code |
| MAC sequential [5] | progress-insensitive NI | **Agda** | simply-typed λ-calculus core |
| MAC concurrent [5] | scheduler-parametric **PSNI** | **Agda** | round-robin instantiation |
| Faceted λ-calculus [6] | TINI + projection theorem | paper proof | Firefox/Zaphod prototype |
| SME [7] | **TSNI** + precision | paper proof | FlowFox browser; Haskell library |

*Table 3. Formal guarantees across the surveyed systems (bold = mechanized).*

Empirically, faceted execution's Firefox prototype showed interactive-browsing overhead low enough for real use, with facet-collapse doing most of the work [6]. LIO's overhead concentrates at `unlabel`/reference operations — negligible coarse-grained, punitive for fine-grained hot loops [4]. MAC pays nothing at runtime (labels erase) but pays in annotation burden — the static/dynamic tradeoff as developer friction. SME's cost is the most honest: factor-*n* slowdown for *n* levels, mitigated only by sharing (facets).

## 6 Limitations

1. **Declassification is trust, not mathematics.** Every practical system punches a hole — privileges, `runTCB`, escape hatches — and whole-system security rests on auditing those holes. Robust declassification and delimited release *constrain* them but cannot eliminate the judgment call [8].
2. **Termination and timing are second-class.** Most deployable systems guarantee TINI only. TSNI (SME) costs duplication; PSNI (MAC) needs scheduler discipline most platforms won't provide.
3. **Label creep and annotation burden are usability failures.** IFC succeeds where policy can be *inferred or defaulted* (browsers, OS compartments), not hand-authored per function.
4. **Covert channels below the language.** Cache timing, speculation, and power analysis sit beneath any language model; IFC composes with systems defenses but does not replace them.
5. **Mechanization covers calculi, not implementations.** The Coq and Agda models verify *formal calculi*; the Haskell libraries add FFI, laziness subtleties, and GHC behavior the models abstract.
6. **Static analysis is necessarily incomplete.** No complete type system for noninterference exists in a Turing-complete language; the false-positive rate on real codebases remains static IFC's main adoption blocker.

## 7 Conclusion

Fifty years after Denning's lattice, the field has a stable core: a **policy** (lattice order), a **property** (noninterference: TINI/TSNI/PSNI), a **mechanism** (static types, dynamic monitors, faceted values, multi-execution), and a **proof** (unwinding or erasure, increasingly mechanized). LIO proved dynamic IFC could be a library; MAC proved static IFC could be a library *with a machine-checked proof*; faceted execution and SME proved noninterference could be enforced without analyzing the program at all.

The open problems are no longer "can we enforce noninterference?" but "can we enforce it *usefully*?": expressive yet auditable declassification, termination-sensitivity without prohibitive cost, policy expression ordinary developers can wield, and verified stacks from calculus to machine code. The trajectory from [1] to [5] suggests the next decades will be spent less on new mechanisms — the design space is well mapped — and more on *closing the gaps*: calculus to implementation, TINI to TSNI, whiteboard lattice to code labels.

## References

[1] D. E. Denning, "A lattice model of secure information flow," *Communications of the ACM*, vol. 19, no. 5, pp. 236–243, 1976. https://doi.org/10.1145/360051.360056

[2] D. Volpano, C. Irvine, and G. Smith, "A sound type system for secure flow analysis," *Journal of Computer Security*, vol. 4, no. 2–3, pp. 167–187, 1996. https://doi.org/10.3233/JCS-1996-42-304

[3] A. Sabelfeld and A. C. Myers, "Language-based information-flow security," *IEEE Journal on Selected Areas in Communications*, vol. 21, no. 1, pp. 5–19, 2003. https://doi.org/10.1109/JSAC.2002.806121

[4] D. Stefan, A. Russo, J. C. Mitchell, and D. Mazières, "Flexible dynamic information flow control in Haskell," in *Proc. 4th ACM SIGPLAN Symposium on Haskell (Haskell '11)*, pp. 95–106, 2011. https://doi.org/10.1145/2034675.2034688 — Full version with exceptions: https://www.cse.chalmers.se/~russo/publications_files/jfp12.pdf

[5] M. Vassena and A. Russo, "On formalizing information-flow control libraries," in *Proc. 11th ACM SIGPLAN Workshop on Programming Languages and Analysis for Security (PLAS '16)*, pp. 15–28, 2016. https://doi.org/10.1145/2993600.2993608 — Agda mechanization: https://github.com/marco-vassena/agda-mac

[6] T. H. Austin and C. Flanagan, "Multiple facets for dynamic information flow," in *Proc. 39th ACM SIGPLAN-SIGACT Symposium on Principles of Programming Languages (POPL '12)*, pp. 165–178, 2012. https://doi.org/10.1145/2103656.2103677 — Journal version: https://users.soe.ucsc.edu/~cormac/papers/toplas17.pdf

[7] D. Devriese and F. Piessens, "Noninterference through secure multi-execution," in *Proc. 31st IEEE Symposium on Security and Privacy (S&P '10)*, pp. 109–124, 2010. https://doi.org/10.1109/SP.2010.15 — PDF: https://www.cse.chalmers.se/~russo/publications_files/sme.pdf

[8] A. Sabelfeld and D. Sands, "Dimensions and principles of declassification," in *Proc. 18th IEEE Computer Security Foundations Workshop (CSFW '05)*, pp. 255–269, 2005. https://doi.org/10.1109/CSFW.2005.8
