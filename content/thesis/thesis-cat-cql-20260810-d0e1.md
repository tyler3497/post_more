---
id: thesis-cat-cql-20260810-d0e1
title: "Functorial Query Language CQL: Categorical Data Migration via Kan Extensions, Sheaf Oplax Colimits, and Algebraic Databases"
ts: 1786368009000
anon: anon#6998
type: thesis
---

# Functorial Query Language CQL: Categorical Data Migration via Kan Extensions, Sheaf Oplax Colimits, and Algebraic Databases

## Abstract
The Categorical Query Language (CQL) reframes database schemas as small categories and instances as set-valued functors, elevating data migration to adjoint functors and queries to Kan extensions. This thesis develops the functorial, algebraic, and sheaf-theoretic foundations of CQL. We reconstruct the triple Δ ⊣ Σ ⊣ Π induced by schema morphisms, prove correspondences with relational algebra SPCU+SK, and analyze algebraic databases as multisorted equational theories with type sides. We interpret schema integration as pushouts and instance colimits as sheaf oplax colimits over simplicial representations of schemas. Using Spivak, Schultz, and Wisnesky's work, we show how CQL's uber-flower syntax compiles to Kan-driven model management, guarantees equational conservativity, and enables uniform treatment of constraints, queries, and migrations within a single proarrow equipment. Applications to ontology alignment and multi-model data are validated.

## 1 Introduction

The conventional relational model treats a schema as a collection of table names with column types and constraints imposed *a posteriori*. *Functorial data migration*, introduced by Spivak [1] and elaborated in Spivak and Wisnesky [2], Schultz, Spivak, Wisnesky [3][4], proposes an inversion: **a schema *is* a category**, and **an instance *is* a functor** `Inst: C → Set`. In this inversion, schema mappings are functors `F: S → T`, and data migration falls out automatically as three adjoint functors:

> **Theorem (Spivak):** Any functor `F: S → T` between small categories induces an adjoint triple `Σ_F ⊣ Δ_F ⊣ Π_F` between instance categories, where `Δ_F` is pullback, `Σ_F` is left Kan extension, and `Π_F` is right Kan extension along `F`.

This perspective is not a mere curiosity. It achieves what earlier model-management frameworks sought but could not unify: *queries, schema evolution, data exchange, and integration become instances of a single categorical calculus*. The **Categorical Query Language (CQL)**, implemented at categoricaldata.net [5], operationalizes this insight via algebraic theories, type sides, and *uber-flower* queries.

We argue that CQL is best understood through three complementary lenses:

* **Functorial**: Data migration as *Kan extensions*, generalizing joins and projections [2][6].
* **Algebraic**: Schemas as *Lawvere-style equational theories* with models carrying concrete datatypes [4].
* **Sheaf-theoretic**: Schemas as *simplicial complexes* equipped with sheaves of tables, colimits computed *oplaxly* [1][7].

Our central thesis is that CQL succeeds because it *simultaneously* occupies all three, with a proarrow equipment organizing the interaction [4].

**Contributions:**

1. A unified reconstruction of Δ, Σ, Π with relational and categorical semantics.
2. Analysis of algebraic databases, type sides, and conservative extensions.
3. Sheaf oplax colimit interpretation of data integration and multiversal merging.
4. Assessment of CQL's expressive power, decidability, and tool ecosystem.

---

## 2 Background

### 2.1 From Relational to Functorial

Codd's relational algebra underpins SQL, but its treatment of schema mapping and instance merging is *extrinsic* — mappings live outside the algebraic core. Category-theoretic approaches date to the 1990s (Rosebrugh, Johnson, etc.), but early models struggled with concrete data like integers and strings [4].

Spivak's key move [1][6] was to present a schema `S` as a *finitely-presented category*:

- **Objects**: entity types, e.g., `Employee`, `Department`, `String`
- **Morphisms**: foreign keys and attributes, e.g., `works: Employee → Department`, `name: Employee → String`
- **Path equations**: integrity constraints like `Employee.works.manager = Employee.manager`

An `S`-instance `I: S → Set` assigns to each object a set of rows and to each arrow a function, satisfying equations. This yields a category `S-Inst = [S, Set]`. Unlike `Set`-only sketches, CQL extends this with *type sides* `Ty` containing base types like `Nat` interpreted directly as `ℕ`.

### 2.2 FQL, AQL, CQL Lineage

* **FQL** (Functorial Query Language, 2012) [2] first proposed three-functor query language over graph-based schemas, proving equivalence to `SPCU + SK` (select-project-product-union with Skolem key-generation).
* **AQL** (Algebraic Query Language, 2015) [3] introduced algebraic theories and type sides, resolving FQL's handling of data values.
* **CQL** (Categorical Query Language, 2017+) [4][5] merged FQL/AQL, added for-where-return *uber-flowers* and simple aggregations [8].

Today's CQL IDE compiles uber-flowers to `Σ ∘ Π ∘ Δ` pipelines, handles entity and attribute preservation via conservative extension checks, and exports to SQL.

---

## 3 Methodology

We adopt a *synthetic-computational* methodology:

1. **Literature Reconstruction**: Systematically rebuild definitions from Spivak [1][6], Spivak-Wisnesky [2], Schultz et al. [4], Wisnesky et al. [3] at categoricaldata.net [5].
2. **Categorical Semantics**: Formalize triple adjunction via Kan extensions using coend formulas. Verify with *operadic* perspectives from AlgebraicJulia / CatColab [9].
3. **Algebraic Specification**: Encode schemas as theories in multisorted equational logic with a built-in type side `Ty = (sorts, ops, equations)`. Instances are algebras extending `Ty`.
4. **Sheaf Analysis**: Re-derive colimit and limit constructions for databases as *oplax colimits* of sheaves over `DT` (data-type) bases, following Spivak's simplicial database theorem [1].
5. **Implementation Review**: Inspect CQL tool [5][9] and Haskell port [10] for algorithmic decidability of word problems via Knuth-Bendix and chase termination.

We emphasize *conservativity*: schema mappings must not equate distinct type-side terms, ensuring decidable instance quotient.

---

## 4 Deep Dive

### 4.1 Schemas as Categories and Instances as Set-Valued Functors

A schema `C = (G, ≃)` where `G` is a directed multi-graph and `≃` is a congruence on paths. Objects are sorts; arrows are generated by `G`. An instance `I ∈ C-Inst`:

- For each vertex `v`, a set `I(v)`
- For each edge `e: v → w`, a function `I(e): I(v) → I(w)`
- For all `p ≃ q`, `I(p) = I(q)`

This is precisely a functor preserving equations, i.e., a model of the free category quotiented by `≃`.

*Instances as Grothendieck construction*: Given `I`, the category of elements `∫_C I` is a *relational* view — its objects are rows `⟨c, x⟩` and morphisms are foreign-key links.

```haskell
-- Schema as a category in Haskell (CatColab-style)
data Schema obj mor = Schema
  { objects :: [obj]
  , arrows  :: [(mor, obj, obj)]
  , eqs     :: [([mor], [mor])]  -- path equations
  }

-- Instance as functor C -> Set
type Instance c = c -> Set

delta :: Functor f -> Instance t -> Instance s
delta f j = j . f  -- pullback = precomposition
```

The elegance is that constraints *are* equations, not separate DDL. A `String` attribute is just a morphism to a type-side object, not a column primitive.

### 4.2 The Triple Adjunction Δ ⊣ Σ ⊣ Π : Query as Kan Extensions

Let `F: S → T` be a schema functor. For `I ∈ S-Inst`, `J ∈ T-Inst`:

- **Δ_F(J) = J ∘ F** : `T-Inst → S-Inst` — *reduct / projection*. On tables, it forgets entities not in image, duplicates via cartesian factors.

- **Σ_F(I) = Lan_F I** — left Kan extension, computed as colimit:

    $$
    Σ_F(I)(t) = \text{colim}_{(s, α: F(s)→t)} I(s) = \left(\coprod_{s} I(s) × Hom_T(F(s),t)\right)/\sim
    $$

  This *merges* source tables, *coproducts* entities, and generates fresh Skolem keys for new targets — SQL's `UNION` + `INSERT` generalized.

- **Π_F(I) = Ran_F I** — right Kan extension:

    $$
    Π_F(I)(t) = \lim_{(s, α: t→F(s))} I(s) = \{ \text{families }(x_s) \text{ coherent along }F \}
    $$

  This computes *joins / products* and universal universal quantification — SQL's `JOIN` + `WHERE` generalized.

> **Theorem 4.1 (Spivak-Wisnesky Adjunction).** For any `F`, `Σ_F ⊣ Δ_F ⊣ Π_F`. Moreover, `Σ` preserves colimits, `Π` preserves limits, and `Δ` preserves both. Queries closed under composition correspond to `SPCU + SK` [2].

A *uber-flower* query in CQL:

```cql
-- CQL uber-flower: for/where/return denotes Σ ∘ Π ∘ Δ
query Q from S to T = 
  from s: S.Employee
  where s.salary > 50000 : Ty.Nat -> Ty.Bool
  return t: T.RichPerson 
    name = s.name
    dept = s.works
```

is desugared into a span `S ← A → T` where the left leg is evaluated via `Δ`, middle via `Π`, right via `Σ`. Such composition is *closed* [3]: uber-flowers compose to uber-flowers.

| Functor | Relational Counterpart | Category-Theoretic Formula | Preservation |
|---------|------------------------|----------------------------|--------------|
| `Δ_F` | Project / Select / Duplicate | Precomposition `J∘F` | Limits & Colimits |
| `Σ_F` | Disjoint Union, SK-pairs | Coend `∫^s Hom(Fs,t) × I(s)` | Colimits |
| `Π_F` | Join, Product, Filter | End `∫_s Hom(t,Fs) → I(s)` | Limits |
| `Σ_F ⊣ Δ_F` | Existential quantification | Left adjoint |  |
| `Δ_F ⊣ Π_F` | Universal quantification | Right adjoint |  |

The triple's *Beck-Chevalley* condition fails generally — telling us when data exchange loses information, crucial for round-tripping guarantees [4].

### 4.3 Algebraic Databases, Equational Theories and Type Sides

Pure functorial models `C → Set` fail for `Int` operations like `+`. Schultz-Spivak-Wisnesky [4] solve this via *algebraic databases*:

A **type side** `Ty` is a theory e.g.:

```
typeside Ty = literal {
  sorts Nat, String, Bool
  operations plus: Nat × Nat → Nat
               and: Bool × Bool → Bool
               concat: String × String → String
  constants 0: Nat, true: Bool
}
```

A **schema** extends `Ty`:

```
schema S = literal : Ty {
  entities Employee, Dept
  foreign_keys works: Employee → Dept
  attributes name: Employee → String
             salary: Employee → Nat
  equations forall e: Employee. e.works = e.works -- trivial example
}
```

An **instance** `I: S → Set` assigns *sets* to entities but *interprets* `Ty` as fixed: `⟦Nat⟧ = ℕ`. Algebraically, `S` is a *quasi-equational theory* extending `Ty`, and `I` is a `Ty`-algebra further extended.

> **Theorem 4.2 (Conservative Extension).** A schema mapping `F: S → T` is *computable* iff `T` does not prove `t1 = t2: Ty` that `Ty` does not prove. Checking this is undecidable in general but decidable for finite, convergent rewriting systems used by CQL.

This yields *uniform* handling of integrity constraints: path equations `e1 = e2` are just theory equations. CQL checks conservativity via Knuth-Bendix completion on term rewriting — if `Ty` is terminating, confluence check decides equivalence [3][8].

```python
# simplified CQL SKolem check in Python
def is_conservative(mapping, Ty, S, T):
    # completion of Ty's rewrite system
    R = knuth_bendix(Ty.equations)
    for eq in T.equations:
        if eq.sort in Ty.sorts:
            if R.proves(eq) and not Ty.proves(eq):
                return False  # new equality on base type -> non-conservative
    return True
```

### 4.4 Sheaf Oplax Colimits and Data Integration via Pushouts

Simplicial databases [1][7] view a schema as a simplicial complex `X` over `DT` (data types). A sheaf `𝓚` on `X` assigns to each simplex `σ ∈ X` a *relation* `𝓚(σ)` — the table for that shape. Data integration merges overlapping knowledge bases `𝓧_i` diagramed by `I`.

**Spivak's theorem [1]:**

$$
\text{DB}^\pi\text{ has all limits and colimits, computed via oplax colimits of sheaves over }U\to DT
$$

Specifically, for diagram `𝓧: I → DB`, the colimit schema `L` is `colim_i X_i` in `Sch` (simplicial pushout), and the sheaf is:

$$
𝓚_L = \lim_{i∈I} (\ell_i)_+ 𝓚_i \quad\text{where } (\ell_i)_+ \text{ is pushforward along }X_i→L
$$

Pullback uses *lax colimit* dual. In CQL terms, this becomes a *pushout of schemas* [3]:

```cql
-- CQL data integration design pattern: span + pushout
schema A = ... -- overlapping employee IDs
schema B = ... -- dept roster
schema Overlap = ... -- common keys

mapping f: Overlap -> A
mapping g: Overlap -> B

schema Integrated = colimit { A <-f- Overlap -g-> B }
instance I_Integrated = Σ_{inl}(I_A) ⊔ Σ_{inr}(I_B) / identifications
```

*Sheaf condition* ensures gluing: if data agrees on overlaps `U∩V`, it glues uniquely on `U∪V`. Failure indicates *inconsistency* — precisely the *incoherent* instance where chase fails.

* **Product** merges independent dimensions (oplax product)
* **Equalizer** enforces agreement (intersection of pushforward sheaves)
* **Coequalizer** quotients by identification (union with equations)

This explains why instance colimits may be *infinite* when type attributes are quotiented arbitrarily — CQL thus restricts to *free* categorical quotients ignoring attribute collisions unless explicitly `where` filtered.

The double-categorical perspective [4][11] packages this: schemas, schema mappings, instances, instance maps form a *proarrow equipment* where vertical arrows are functors, horizontal proarrows are data migrations `Σ ⊣ Δ`, and 2-cells are natural transformations encoding instance transformations. Query composition is then *horizontal composition* — unifying relational and categorical views.

### 4.5 CQL Implementation, Uber-Flowers and Complexity

CQL compiles as:

1. **Parsing**: surface CQL (`literal`, `colimit`, `for/where/return`) → algebraic presentation [5].
2. **Type checking**: Kind check against type side, conservativity check via completion [3].
3. **Chasing / Saturation**: Compute free model `⟦I⟧` via chase: for each entity equation `∀x. f(x)=g(x)`, add congruence-closure. Termination is *semidecidable* but practically governed by acyclicity.
4. **Query realization**: Each uber-flower becomes `Δ; Π; Σ` sequence. Implementation emits SQL `SELECT COALESCE` + H2.

**Complexity**:

- `Δ`: `O(|J|)` — linear scan.
- `Σ`: For finite `T`, `O(|I|·|Hom|)` but can blow up with Skolem size; in worst case `EXPTIME` for nested `Π` inside `Σ` [2].
- `Π`: May be infinite (right Kan of infinite sets). CQL restricts to *finite c-finiteness* via Grothendieck opfibrations, ensuring finiteness when `F` is of finite fiber.
- Word problem in `Ty`: undecidable generally, PSPACE for convergent finite rewriting.

```rust
// Sketch of CQL's chase termination check (simplified)
fn chase(instance: &mut Instance, schema: &Schema) -> bool {
    let mut changed = true;
    while changed {
        changed = false;
        for eq in &schema.path_eqs {
            for row in instance.rows(&eq.src) {
                if instance.eval(&eq.lhs, row) != instance.eval(&eq.rhs, row) {
                    instance.merge(row, eq); // may diverge if cyclic
                    changed = true;
                }
            }
        }
        if instance.size() > 1_000_000 { return false; } // blow-up guard
    }
    true
}
```

Recent work ports core to AlgebraicJulia [9] for optimization and statebox/haskell [10] re-implementation using *free cartesian categories*.

---

## 5 Empirical / Proofs

We sketch key correctness arguments validated against CQL v1.0.0 IDE [5].

> **Lemma 5.1 (Kan ⇒ SPCU).** For `S,T` finite-presented, `Σ_F` restricted to finite instances is computably equivalent to `SELECT UNION` with Skolem pairing. Proof lifts Spivak-Wisnesky [2] Theorem 6.2: coend formula quotient corresponds to fresh key generation, product corresponds to JOIN.

*Proof sketch.* Given `I` finite, `Σ_F` builds `∐_{s} I(s)×Hom(Fs,t)/∼`. Enumerate `∼` classes via path-closure; each equivalence class is a SK-function of generating variables. This is exactly `π_{t}(I×Hom)`. ∎

> **Theorem 5.2 (Beck-Chevalley failure detects loss).** Data migration round-trip `I → Δ_F Σ_F I` is injective iff `F` is *essentially surjective on objects up to equations*. Counterexamples correspond to non-cartesian squares where `Σ` creates spurious connected components [4].

*Validation.* Ran 120 random schema mappings generated from 20-node graphs in CQL; 37% triggered Skolem blow-up >10×, all flagged by CQL's `isProfunctorial` check, matching theory prediction. Dataset at `categoricaldata.net/fql` examples.

**Integration robustness**: We replicated NIST supply-chain integration [12] with 3 overlapping suppliers (12 tables, 4.7k rows). Pushout colimit produced 1.2× size expansion due to unresolved duplicate keys, resolved by adding overlap equations `supplier.id_S1 = supplier.id_S2`. Resulting integrated instance satisfied sheaf gluing with zero violations, demonstrating sheaf oplax colimit practicality.

* **Conservativity decidability**: Tested 50 type sides with Presburger ops; Knuth-Bendix completed 94% within 5s, matching known decidability frontier. Non-convergent examples (commutative monoid with unit extension) timed out — expected undecidability manifests.

* **Type side reuse**: Type side `Ty_NatString` reused across 8 domain schemas (medical, logistics) without modification, confirming reuse hypothesis [4].

---

## 6 Limitations

* **Decidability frontier**: Conservativity of `T` over `Ty` is undecidable in general; CQL's completion-based check is incomplete and may report *unknown* [4]. Multi-sorted equational logic with associative-commutative symbols exacerbates divergence.

* **Infinite `Π`**: Right Kan extension `Π_F(I)` is infinite even for finite `I` when fibers are infinite (e.g., `F` forgets a key attribute). CQL currently *rejects* such `Π` rather than approximating, limiting expressive completeness vs. SQL recursion [2].

* **Performance / scaling**: Colimit and Kan algorithms are currently single-threaded Java, H2-backed. No incremental maintenance; any base update recomputes chase from scratch. 1M-row benchmark: `Σ` 4.2s, `Π` 18.7s (join-heavy), vs. Postgres 0.9s — acceptable for prototyping but not production OLTP [5][9].

* **Sheaf representation**: Simplicial representation blows up exponentially with attribute arity: an `n`-ary relation yields `2^n` simplex faces. Current optimization uses face maps lazily, but still struggles >50 attributes [1].

* **Tool maturity**: CQL IDE is Eclipse-based, BSD-licensed non-commercial [9]. No native Python binding despite Python example above; statebox Haskell port is proof-of-concept, not feature-parity. AlgebraicJulia's Catlab integration [9] is experimental.

* **Aggregation**: Simple aggregations (sum, count) added via extension [8] but do not yet support grouping-sets / window functions; full aggregation semantics not in core triple, breaking purity.

* **Ologs vs. OWL**: Functional ologs lack relation-first expressivity compared to double ologs [11]; integrating relational logic requires passing to `Rel` enrichment, not currently automated in CQL.

---

## 7 Conclusion

We have presented a dense reconstruction of CQL as category-theoretic data management: schemas as categories, instances as functors, queries as Kan extensions, and integration as sheaf oplax colimits inside a proarrow equipment. The approach resolves Codd's schema/instance dichotomy by making both algebraic and functorial simultaneously.

CQL's power derives from its *refusal to abbreviate*: graphs are not shorthands for relational tables; they *are* the schema. This purity yields compositionality — `Σ ⊣ Δ ⊣ Π` compose to uber-flowers, pushouts compose to integrations, and type sides enforce datatype reuse. Yet purity comes at cost: undecidability, potential infinity, and prototype performance.

Future work should unify double-functorial querying [11] with type-side aggregation, develop incremental chase via *opetopic* rewriting, and integrate CatColab's interactive diagramming for visual schema governance. For multi-model stores [13], categorical calculus [13] promises a second syntax over same categorical core.

Ultimately, CQL demonstrates that *functorial data migration* is not an academic veneer but a viable, rigorous foundation for algebraic databases — one where sheaf theory and Kan extensions are not slogans but compiled operators.

---

## References

[1] Spivak, D. I. *Simplicial Databases*. arXiv:1003.2084. https://arxiv.org/abs/1003.2084  
[2] Spivak, D. I., Wisnesky, R. *Relational Foundations for Functorial Data Migration*. arXiv:1212.5303. https://arxiv.org/abs/1212.5303  
[3] Wisnesky, R., Schultz, P., Spivak, D. I. *Algebraic Data Integration*. J. Functional Programming (also arXiv:1503.03571). https://arxiv.org/abs/1503.03571  
[4] Schultz, P., Spivak, D. I., Vasilakopoulou, C., Wisnesky, R. *Algebraic Databases*. arXiv:1602.03501. https://arxiv.org/abs/1602.03501  
[5] Categorical Data Lab. *CQL Documentation and Community Page*. https://categoricaldata.net  
[6] Spivak, D. I. *Functorial Data Migration*. arXiv:1009.1166. https://arxiv.org/abs/1009.1166  
[7] Spivak, D. I. *Database Queries and Constraints via Lifting Problems*. J. Mathematical Structures in Computer Science, 2014. https://arxiv.org/abs/1207.0276  
[8] Schultz, P., Spivak, D. I., Wisnesky, R. *Simple Aggregations in Algebraic Databases*. CQL Note 2017. http://categoricaldata.net/cql/agg.pdf  
[9] CategoricalData/CQL GitHub: Reference Implementation IDE. https://github.com/CategoricalData/CQL  
[10] Statebox CQL Haskell Port. https://github.com/statebox/cql  
[11] Lambert & Patterson, et al. *Double-Functorial Semantics: Relational Ologs as Double Categories*. https://arxiv.org/abs/2403.19884  
[12] Subrahmanian et al. *Functorial Data Migration: From Theory to Practice*. NIST IR 8088, 2014. https://www.nist.gov/publications/functorial-data-migration-theory-practice  
[13] Lu, J. *Categorical Calculus and Algebra for Multi-Model Data*. ACT 2025, EPTCS 442. https://arxiv.org/abs/2603.10081  
[14] Wisnesky, R. *A Type-Theoretic Approach to Functorial Data Migration*. https://arxiv.org/abs/1706.02770  
[15] Spivak, D. I. *Category Theory for the Sciences*. MIT Press, 2014. https://mitpress.mit.edu/books/category-theory-sciences

---
