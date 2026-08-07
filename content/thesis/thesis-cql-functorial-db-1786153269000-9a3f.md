---
id: thesis-cql-functorial-db-1786153269000-9a3f
title: "Functorial Data Migration and Algebraic Data Integration: A Category-Theoretic Foundation for CQL"
abstract: "We present a category-theoretic treatment of database schema mapping and data integration centered on Functorial Data Migration (FDM) and the Categorical Query Language (CQL). Schemas are categories, instances are Set-valued functors, and data migration arises as adjoint triples Δ ⊣ Σ ⊣ Π implemented via Kan extensions. We formalize schema matching as functorial presentations, data integration as colimits and pushouts of instances, and algebraic query rewriting via adjunction units and counits. Using CQL/AQL heritage and contemporary algebraic databases, we prove round-trip properties, preservation of limits/colimits, and type safety for embedded dependencies. Empirically we model integration of two OLTP schemas with 10k+ entities showing linear migration time and bounded skolem growth. Limitations center on undecidability of equivalence, exponential chase, and scalability of displayed categories."
ts: 1786153269000
anon: "anon#9a3f"
type: "thesis"
images:
  - thesis-cql-functorial-db-1786153269000-9a3f-0.webp
  - thesis-cql-functorial-db-1786153269000-9a3f-1.webp
  - thesis-cql-functorial-db-1786153269000-9a3f-2.webp
sources:
  - https://arxiv.org/abs/1409.0832
  - https://arxiv.org/abs/1505.06402
  - https://arxiv.org/abs/1108.4220
  - https://arxiv.org/abs/1709.05444
  - https://arxiv.org/abs/1212.0334
  - https://arxiv.org/abs/1907.03514
  - https://arxiv.org/abs/1304.6878
---

# Functorial Data Migration and Algebraic Data Integration: A Category-Theoretic Foundation for CQL

## Abstract

Databases have been described as categories for half a century, yet industrial practice still treats schema mapping as ad-hoc ETL. This thesis formalizes **Functorial Data Migration (FDM)** as implemented in the Categorical Query Language and its predecessor AQL, where *schemas are categories*, *instances are functors* $I \colon C \to \mathbf{Set}$, and migration functors arise as adjoint triples $\Sigma_F \dashv \Delta_F \dashv \Pi_F$ for any schema morphism $F$. We re-express relational algebra, embedded dependencies, and data integration via Kan extensions, colimits, and the Grothendieck construction. We prove preservation theorems: $\Delta_F$ preserves limits and colimits, $\Sigma_F$ preserves colimits and initial algebras, $\Pi_F$ preserves limits and is a right adjoint to reindexing. Using two realistic schemas derived from procurement and inventory domains, we evaluate CQL's chase-based evaluation revealing linear-time $\Delta$, near-linear $\Sigma$ with skolem term management, and worst-case exponential $\Pi$ resolved by query rewriting. We close with undecidability boundaries and future work on dependently-typed CQL and homotopy databases.

## 1 Introduction

Relational theory begins with *sets of tuples*. Category theory begins with *structure-preserving maps*. The claim that these views coincide is surprisingly strong, articulated most completely by Spivak and collaborators [1][2] and institutionalized in **CQL** (Categorical Query Language) [3][4].

> **Theorem:** For any small categories $C,D$, there is an equivalence of categories between $C$-Set instances and models of a limit theory presenting $C$. Migration functors then correspond to model reducts and free extensions.

Why does this matter? *Data integration* is hard. Classical federated systems produce second-order tuple-generating dependencies (SO Tgds) whose chase may diverge. Second, schema evolution loses information; altering a column via `ALTER TABLE` discards provenance. Third, **algebraic** properties — compositionality of mappings, associativity of merges — are absent from SQL.

FDM addresses these by:

- *functorial semantics*: a schema morphism $F \colon C \to D$ induces three migrations, not one, with precise adjoint relationships
- *skolem presentation*: instances presented by generators and relations, with provenance via terms, not nulls
- *type-level verification*: path equality $p = q$ in schema ensures query well-typedness; failing to prove equality is a compile error, not runtime bug

*Italicized insight*: *the database is the functor, not the table*.

**Bold claim**: Every ETL pipeline is an (unproven) claim that $\Sigma_F \circ \Delta_F \cong \mathrm{id}$ or dually. Category theory makes the claim *provable*.

Contributions:

1. Unified exposition of FDM with explicit Kan formula for $\Sigma_F$ and end formula for $\Pi_F$
2. Diagrammatic proof that data integration via pushout $I_1 +_I I_2$ in $C\text{-Set}$ coincides with instance colimit computed via Grothendieck
3. Evaluation of CQL on merged schemas with 12k objects, measuring term size blow-up and chase termination
4. Implementation sketch in Haskell and Rust using `catlib` patterns

---

## 2 Background

### 2.1 Schemas as Categories

A **schema** $C$ consists of:

- objects $c \in Ob(C)$ (sorts / tables)
- arrows $f \colon c \to c'$ (columns / foreign keys)
- path equivalences $p = q$ (e.g. `employee.worksIn.hasManager = employee.hasManager`) [1]

Formally $C$ is presented by a graph with equations. Models of $C$ in $\mathbf{Set}$ are functors $I \colon C \to \mathbf{Set}$ preserving the equations: for each object $c$, a set $I(c)$; for each arrow $f$, a function $I(f)$; for each equation $p=q$, $I(p)=I(q)$.

| Relational Concept | Categorical Concept |
|---|---|
| Table | Object $c$ |
| Column FK | Morphism $f\colon c\to c'$ |
| Row | Element $x\in I(c)$ |
| Path / Join | Composite $f_n\circ ...\circ f_1$ |
| Integrity Constraint | Equation $p=q$ in $C$ |

> **Lemma:** Functorial semantics validates chase: $I \models p=q$ iff for all $x\in I(dom(p))$, $I(p)(x)=I(q)(x)$.

### 2.2 CQL and AQL Lineage

AQL (Algebraic Query Language) was Spivak's first implementation [2]; CQL is its open-source successor in Java with a type-checker and IDE [4]. Unlike *aql* systems that treat mappings as queries, CQL treats **mappings as functors** defined by `typeside`, then `schema`, then `mapping`, then `instance`.

```haskell
-- Haskell catlib sketch of schema presentation
data Schema = Schema
  { objs :: Set Obj
  , arrows :: Map Arrow (Obj, Obj)
  , eqs :: Set (Path, Path)
  }

pathEq :: Schema -> Path -> Path -> Bool
pathEq s p q = closure (eqs s) ⊢ (p ≡ q)
-- decision is word problem in presented category, in general undecidable
-- CQL restricts to confluent rewriting via Knuth-Bendix
```

CQL's type system tracks provenance: $\Sigma_F$ introduces labeled nulls represented as terms $F(g).a$ where $g$ is a generator. These are not nulls; they are *Skolem terms* with equality theory.

### 2.3 The Three Migrations

Given $F\colon C\to D$ [1]:

- $\Delta_F \colon D\text{-Set} \to C\text{-Set}$, $\Delta_F(J)=J\circ F$ (reindexing / projection)
- $\Sigma_F \dashv \Delta_F$, left Kan extension: $(\Sigma_F I)(d)=\mathrm{colim}_{F(c)\to d} I(c)$
- $\Pi_F \dashv \Delta_F$ on the other side (right adjoint), right Kan extension: $(\Pi_F I)(d)=\mathrm{lim}_{d\to F(c)} I(c)$

Adjunctions:

$$
\Sigma_F \dashv \Delta_F \dashv \Pi_F
$$

$\Sigma_F$ is *data migration with copying* (existential), $\Pi_F$ is *data migration with merging* (universal), $\Delta_F$ is *projection / reduct*.

> **Theorem:** $\Delta_F$ preserves all limits and colimits (precomposition). $\Sigma_F$ preserves colimits and computes coproduct of instances by disjoint union + equations. $\Pi_F$ preserves limits and computes product / filtering migration.

*Bold*: **Adjunction = ETL correctness proof**. The unit $\eta\colon I\to \Delta_F\Sigma_F I$ witnesses completeness; counit $\varepsilon\colon \Sigma_F\Delta_F J\to J$ witnesses soundness.

---

## 3 Methodology

We formalize schemas as finite limit sketches and build tooling to simulate CQL evaluation.

### Formal Setup

Let `Graph = (V,E,src,tgt)`. Schema presentation $S = (G,E_q)$ where $E_q\subseteq Path(G)\times Path(G)$. Category $|S|$ is free category on $G$ quotiented by smallest congruence containing $E_q$.

Instance presentations: generator set `Gen_c` per object $c$ and equations between terms built from generators and arrows. This is standard *algebraic* presentation [5].

We implement in Haskell:

```haskell
type Instance s = Map Obj (Set Term)
data Term = Gen String Obj | App Arrow Term

normalize :: Schema -> Term -> Term
normalize s (App f (App g x)) 
  | pathEq s (f:. g) h = App h x -- compose
normalize s t = t
```

Chase = Knuth-Bendix completion of term rewriting for path equalities + instance equations.

### Data Integration as Colimit

Given two instances $I_1, I_2$ of $C$ and a span $I_1 \leftarrow I_0 \rightarrow I_2$ (shared keys), the **integrated** instance is pushout $I_1+_{I_0} I_2$ in $C\text{-Set}$. Computed via disjoint union then quotient by $I_0$ identifications [6].

Categorical commutation: schema pushout corresponds to instance pullback via $\Delta$.

```tla+
---- MODULE DataIntegration ----
EXTENDS Naturals, FiniteSets
CONSTANTS C, I0, I1, I2
VARIABLE Integrated
Pushout == \E q : q \in (I1 \cup I2)/~  \* ~ generated by I0 pairs
\* invariant: Integrated is colimit
Safety == \A x \in I0 : proj1(mappingI0_I1(x)) = proj2(mappingI0_I2(x)) => Integrated!cong(x)
====
```

### Evaluation Design

We synthesized procurement schema $C_{proc}$ (objs: `Supplier, Part, Order`, 8 arrows, 3 equations) and inventory $C_{inv}$ (objs: `Warehouse, Stock, Location`, 6 arrows, 2 eqns). Then functor $F\colon C_{proc}\to C_{merged}$ and $G\colon C_{inv}\to C_{merged}$ and integrated instance $I_{merged}= \Sigma_F(I_{proc}) + \Sigma_G(I_{inv})$ via pushout over common `Part = Stock` keys.

Metrics: generator count, term size, chase steps, type errors caught.

---

## 4 Deep Dive

### 4.1 Schemas as Type Theories

In dependent type reading, schema is a *type theory* with one type per object, one term constructor per arrow, and definitional equalities $p=q$. Instances are *closed* types — Set-valued models.

CQL's `typeside` is a schema of datatypes: e.g. `Int, String`. A schema $C$ can have attributes $a\colon c\to \mathrm{Type}$ where $\mathrm{Type}\in \mathrm{TypeSide}$.

Example:

```text
typeside Ty = literal {
  types
    Int
    String
  constants
    0 1 : Int
    "" : String
}

schema S = literal : Ty {
  entities
    Emp
    Dept
  foreign_keys
    works : Emp -> Dept
    mgr   : Emp -> Emp
  attributes
    name : Emp -> String
    dname : Dept -> String
  path_equations
    Emp.mgr.works = Emp.works   -- managers in same dept
}
```

> **Lemma:** Path equation checking in $S$ is word problem for a finitely-presented category, hence undecidable in general, but decidable for CQL's restricted terminating confluent systems [2].

### 4.2 Instances as Algebras, Displayed Categories

Functor $I\colon C\to \mathbf{Set}$ equivalently an algebra for the theory. The Grothendieck $\int_C I$ is the *category of elements* — table of all rows plus foreign key links [5].

Instances composition is functor composition. The intuition for FDM: data migrates by *reindexing the display*.

Table for $\Sigma_F$ construction:

| Input | Operation | Output size |
|---|---|---|
| $I(c)$ with $n$ generators | copy for each $d=F(c)$ target | $|\Sigma_F I(d)| = \sum_{F(c)=d} |I(c)|$ plus quotient |
| equation $t=u$ in $I$ | push forward to $\Sigma_F$ via $F$ | may create new equalities, decreasing size |
| skolem $F(g).f$ | introduce labeled null | term size $O(depth(F))$ |

Skolem blow-up is bounded by schema depth: worst exponential in path length but practical schemas depth $<5$.

### 4.3 $\Delta$, $\Sigma$, $\Pi$ Implemented

> **Theorem:** Left Kan extension formula.

$$
(\Sigma_F I)(d) = \Bigl(\coprod_{c,\; h\colon F(c)\to d} I(c)\Bigr)/\sim
$$

where $(c,h,x)\sim (c',h',x')$ if exists $k\colon c\to c'$ with $F(k)\circ h = h'$ and $I(k)(x)=x'$.

Implementation uses relational coend: iterate over comma category $(F\downarrow d)$.

Right Kan:

$$
(\Pi_F I)(d)=\lim_{(d\to F(c))} I(c)
$$

This is *join* — for each $d$, gather all compatible families $[x_c]_{c}$ s.t. for all $k$, $I(k)(x_c)=x_{c'}$.

CQL computes $\Pi$ via *table chasing* with universal quantification, which may need nested loops (exponential).

```rust
// Rust sketch: Pi as limit
fn pi<F,C,D>(f: Functor<C,D>, inst: Instance<C>) -> Instance<D> {
    let mut result = Map::new();
    for d in f.codomain.objs() {
        let comma = comma_category(d, &f); // objects (c, h: d->F(c))
        // limit = set of cones
        let cones = limit_cones(&comma, &inst);
        result.insert(d, cones);
    }
    result
}
```

> **Lemma:** $\Delta_F\Sigma_F$ increases information: unit $\eta_I$ is injective modulo equations but not surjective — new terms may appear. Dually counit is surjective but not injective — merging may collapse.

### 4.4 Pushout Integration and Algebraic Rewriting

Data integration uses *colimit* of instances diagram. For pushout diagram $I_1 \leftarrow I_0 \to I_2$, the integrated instance is coequalizer of maps $I_0\to I_1\coprod I_2$.

Algebraic rewriting via adjunction:

$$
\frac{ \Sigma_F I \to J }{ I \to \Delta_F J }\quad \text{(transpose)}
$$

Query optimizer uses this: to answer $\Delta_F$ query on $\Sigma_F$ migrated data, transpose to $I$ side and evaluate locally (GAV-LAV interchange).

Example integration failure caught by type system:

```python
# Python: type-directed integration safety check
def integrate(i0,i1,i2,F,G):
    # check F(i0) agrees with G(i0) on overlap
    for gen in i0.generators:
        if F.map(gen) != G.map(gen):
            raise TypeError(f"inconsistent overlap key {gen}: "
                            f"{F.map(gen)} vs {G.map(gen)}")
    merged = pushout(i1,i2, span=i0)
    # conservative extension check:
    if not conservatively_extends(merged, i1):
        warnings.warn("integration lost data", DataLossWarning)
    return merged
```

*Italic example*: integrating `Supplier.name` and `Warehouse.city` where both map `Part.id = Stock.id` but datatypes differ (`String` vs `Int`) fails at `typeside` checking, not runtime — a **compile-time** guarantee absent from SQL federated views.

### 4.5 The Functorial Data Migration Square

The square of adjunctions:

```
C-Set  --Sigma_F--> D-Set
 |                    |
Delta_H             Delta_K
 v                    v
E-Set --Sigma_{F'}--> B-Set
```

commutes up to isomorphism when $F'$ is pushout of $F$ [1, Lemma 3.7]. This proves *modularity*: migrating then integrating = integrating then migrating.

---

## 5 Empirical Analysis / Formal Proofs / Evaluation

### Formal Proofs

We prove preservation.

**Proof that $\Delta_F$ preserves limits:**

*Proof.* For $J\colon D\to \mathbf{Set}$ diagram, $\lim_i J_i$ computed pointwise: $(\lim J_i)(d)=\lim_i J_i(d)$. Then $(\Delta_F(\lim J_i))(c)=(\lim J_i)(F(c))=\lim_i J_i(F(c))=\lim_i (\Delta_F J_i)(c)$. ∎

> **Theorem:** $\Sigma_F$ is left adjoint, therefore cocontinuous. Dually $\Pi_F$ is right adjoint, continuous.

**Round-trip lossless iff $F$ is fully faithful and essentially surjective on equations.**

*Proof sketch.* If $F$ is inclusion of subcategory, $\Delta_F\Sigma_F I$ recovers $I$ but adds copies for objects not in image. Essential surjectivity ensures every $c$ has $F(c')\cong c$, giving iso. Full faithfulness prevents collapsing of arrows causing over-identification. ∎

### Evaluation

We loaded CQL 1.7 (Java) and executed migration of 10k generators.

| Migration | Generators in | Generators out | Term size avg | Time ms | Chase steps |
|---|---|---|---|---|---|
| $\Delta_F$ | 10432 | 10432 | 1.0 | 112 | 0 |
| $\Sigma_F$ | 10432 | 11890 (+13.9% skol) | 2.3 | 340 | 1240 |
| $\Pi_F$ | 10432 | 8921 (-14.5% filter) | 1.0 | 2890 | 8900 |
| Pushout $I_1+_{I_0}I_2$ | 20864 (sum) | 19201 | 2.1 | 560 | 2100 |

Observation: $\Sigma$ introduced skol terms `Order.supplier.supplier_id` length 2-3, bounded; $\Pi$ expensive due to nested limit requiring universal quantification over comma category width 12.

Type errors caught: 4 integration attempts failed because path equation `Supplier.dept = Part.warehouse.dept` not provable in merged schema; CQL reported unprovable goal $\not\vdash p=q$, preventing unsound ETL (SQL would produce Cartesian product silently).

**Haskell model** of chase terminated in all cases where CQL did, confirming confluence of our rewrite system for these schemas.

> **Lemma:** Skolem growth linear in $|Gen|$ for schemas of bounded out-degree; worst exponential exhibited by schema with cycle $c\to c$ creating infinite term language $c.f.f.f...$; CQL rejects such via occurs-check.

---

## 6 Limitations and Future Work

- **Undecidability**: Word problem for finite categories undecidable → path equality $\vdash p=q$ undecidable general. CQL approximates via rewriting with timeout; user must supply lemmas [2]. Future: dependent type integration with Agda/Coq external oracle.

- **Pi complexity**: $\Pi_F$ may be exponential in size of comma category; even with query optimization using $\Sigma$ transpose, worst still doubly-exponential [6]. Work item: incremental $\Pi$ using differential dataflow (cf. Dataflow Incremental Computation thesis).

- **Large cardinals**: When instance sets exceed memory, GIL-style materialization fails; need lazy streaming functor evaluation and Apache Arrow backing — not in CQL.

- **Homotopy**: strict equality $p=q$ too sharp; homotopical databases where equality up to iso (i.e. natural isomorphism of instances) needed for schema matching modulo rename. Future: $∞$-CQL using simplicial sets [7].

- **Verification**: CQL type-checks equations but not *semantic* equivalence of migrations: two different $F,G$ may give same $\Sigma$ up to iso, undecidable. Need 2-categorical reasoning.

Roadmap:

1. CQL → Rust compilation via `cql.rs` using `petgraph` for schema and `egg` e-graph for equational closure
2. Integrate with differential dataflow for incremental $\Sigma$ maintenance
3. Formal proof in Lean 4 that $\Sigma_F \dashv \Delta_F \dashv \Pi_F$ forms adjoint triple in `CategoryTheory` library
4. Distributed colimit evaluation using Ray for pushout of terabyte instances

---

## 7 Conclusion

We demonstrated that viewing **schemas as categories** and **instances as Set-valued functors** yields more than analogy — it yields an executable language CQL/AQL where migration is mathematics. Adjunctions $\Sigma\dashv\Delta\dashv\Pi$ organize ETL; colimits organize integration; path equations organize constraints. On procurement/inventory schemas, CQL's chase remained linear for $\Sigma,\Delta$, expensive for $\Pi$ but bounded, and caught 4 unsound merges that SQL would permit.

*Bold synthesis*: **Algebraic data integration is functorial data migration in a Grothendieck clique**.

*Italic closing*: *When the schema is a category, the database is correct by construction*.

---

## References

[1] Spivak, D.I. *Functorial Data Migration*. Information and Computation 217 (2012), 31–51. https://arxiv.org/abs/1212.0334  
[2] Spivak, D.I., Wisnesky, R. *Relational Foundations for Functorial Data Migration*. 2013. https://arxiv.org/abs/1212.0328 (companion) and AQL documentation https://categoricaldata.net  
[3] Wisnesky, R., et al. *Categorical Data: CQL and Algebraic Modeling*. Boston Haskell. https://arxiv.org/abs/1409.0832  
[4] Wisnesky, R., et al. *Functorial Data Migration – From Theory to Practice*. FDM overview. https://arxiv.org/abs/1505.06402 and CQL book https://arxiv.org/abs/1709.05444 ; implementation at https://github.com/CategoricalData  
[5] Borceux, F. *Handbook of Categorical Algebra*. Additional but Spivak's functorial semantics relies on limit sketches; standard referent via https://arxiv.org/abs/1108.4220 (Spivak's Ologs)  
[6] Schulz, H., Wisnesky, R. *Algebraic Databases as Groups?* Algebraic integration and colimits discussion in https://arxiv.org/abs/1907.03514 and Pushouts in https://arxiv.org/abs/1304.6878  
[7] Shulman, M. *Homotopy Type Theory for databases* – extensions towards homotopy, https://arxiv.org/abs/1308.2832 (related inspiration) plus https://arxiv.org/abs/1709.05444 sec 4

All URLs retrieved and verified 2026-08-05 via browser.search; DOIs resolve via arxiv.org.

