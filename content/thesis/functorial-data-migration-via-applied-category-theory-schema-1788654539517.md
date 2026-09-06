---
title: "Functorial Data Migration via Applied Category Theory: Schema Functors, Migration Adjunctions, Data Integration as Kan Extensions, and Preservation Proofs"
id: ths_1788654539517_8842
anon: anon#Q8Z2
ts: 1788654539517
type: thesis
images: ["ths_1788654539517_8842-0.webp", "ths_1788654539517_8842-1.webp", "ths_1788654539517_8842-2.webp", "ths_1788654539517_8842-3.webp"]
---

# Functorial Data Migration via Applied Category Theory: Schema Functors, Migration Adjunctions, Data Integration as Kan Extensions, and Preservation Proofs

## Abstract

Data integration — migrating database instances between heterogeneous schemas — remains among the most expensive and error-prone activities in information systems, with ETL pipelines consuming a dominant share of data-warehouse budgets. David Spivak's functorial data model (2010) proposes a radical simplification: a database schema is a small category *C*, an instance is a Set-valued functor *I: C → Set*, and a schema mapping is a functor *F: C → D*. Every schema morphism then induces three canonical **data migration functors** — the pullback *Δ_F*, the left Kan extension *Σ_F*, and the right Kan extension *Π_F* — in the adjoint chain *Σ_F ⊣ Δ_F ⊣ Π_F*, uniformly subsuming projection, union, and join. This thesis develops the theory in full: categorical foundations, the migration adjunctions, integration as Kan extensions, type-change safety and preservation proofs, and the realization in Spivak and Wisnesky's FQL/CQL systems with ologs. We establish composition closure, expressive equivalence with the SPCU relational algebra, and evaluate the framework on realistic ETL case studies.

## 1. Introduction

Relational database theory has, since Codd, rested on set-theoretic foundations. Yet data engineering is dominated not by querying a single well-designed schema but by *moving data between schemas* — ETL pipelines, schema evolution, warehousing, and mergers routinely translate instances from a source schema *S* to a target *T* along informally specified mappings, typically written in ad-hoc scripts, composed by hand, and validated only by testing: brittle, non-compositional, and resistant to verification.

Category theory was, in Eilenberg and Mac Lane's original conception, designed to migrate theorems from one area of mathematics to another [7] — a strikingly natural language for migrating *data* from one schema to another. In "Functorial Data Migration" [1], Spivak observed that tables, columns, foreign keys, constraints, instances, and integrity rules all admit a uniform categorical semantics:

- A **schema** is a small category *C*: objects are tables (entity types), morphisms are foreign-key columns, and commuting diagrams encode path equations (integrity constraints).
- An **instance** (database state) is a functor *I: C → Set*: each table maps to its set of rows, each foreign key to the function it denotes; functoriality *is* referential integrity.
- A **schema mapping** is a functor *F: C → D* between schema categories.

The decisive payoff: a schema morphism *F* automatically induces **three** data migration functors — *Δ_F*, *Σ_F*, *Π_F* — the pullback and the two Kan extensions along *F*, bound by adjunctions [1]. Spivak and Wisnesky gave this model relational foundations, introduced the algebraic query language **FQL** (later **CQL**), and proved it equivalent to the standard SPCU relational algebra [2]. The framework has been implemented as an open-source ETL tool [8], applied to knowledge representation through **ologs** [3], and exposited for working scientists [4].

This thesis gives a self-contained, PhD-level treatment: (i) the functorial data model and its topos semantics; (ii) the migration adjunctions *Σ_F ⊣ Δ_F ⊣ Π_F* with worked computations; (iii) schema integration and ETL as Kan extensions; (iv) preservation and type-safety theorems with composition closure; (v) empirical evaluation via the FQL/CQL equivalence theorems and ETL case studies; (vi) limitations.

---

## 2. Background

### 2.1 Categories, functors, and natural transformations

A **category** *C* consists of objects, morphism sets *Hom_C(c, d)*, associative composition, and identities [7]. A **functor** *F: C → D* preserves identities and composition. A **natural transformation** *α: F ⇒ G* is a family *α_c: F(c) → G(c)* making every morphism's square commute — the **naturality square**.

The category **Set** of sets and functions plays a distinguished role: functors *I: C → Set* are **copresheaves**, and the functor category *[C, Set]* is the **presheaf topos** on *C*. Toposes support a rich internal logic — limits, colimits, exponentials, a subobject classifier — which is why unions, joins, and selections emerge as special cases of topos structure [1].

### 2.2 Adjunctions and Kan extensions

An **adjunction** *L ⊣ R* is a natural isomorphism *Hom_D(L(c), d) ≅ Hom_C(c, R(d))*: left adjoints preserve colimits, right adjoints preserve limits. Given *F: C → D* and *I: C → E*, the **left Kan extension** *Lan_F(I)* is the universal extension of *I* along *F* from the left, computed pointwise as a colimit over the comma category *(F ↓ d)*; the **right Kan extension** *Ran_F(I)* is dually a limit over *(d ↓ F)* [7]. For *E = Set* these always exist — the computational engine of everything that follows.

### 2.3 The functorial data model

In Spivak's model [1], a schema is presented as a **directed multigraph with path equations**: vertices are tables, edges are columns, and equations declare that two paths denote the same function. This presentation *generates* a small category *C* — the free category on the graph modulo the equations. An instance *I: C → Set* assigns to each table its set of row-IDs and to each column the corresponding function; the path equations become commuting diagrams the instance must satisfy — integrity constraints enforced *by construction*.

The following dictionary [1] translates between the two worlds:

| Database concept | Categorical concept |
|---|---|
| Schema | Small category *C* |
| Table / entity type | Object *c ∈ C* |
| Foreign-key column | Morphism *f: c → d* |
| Path constraint | Commuting diagram in *C* |
| Instance / database state | Functor *I: C → Set* |
| Row | Element *x ∈ I(c)* |
| Referential integrity | Functoriality: *I(g ∘ f) = I(g) ∘ I(f)* |
| Schema mapping | Functor *F: C → D* |
| Query / migration | Migration functors *Δ_F, Σ_F, Π_F* |
| Union | Colimit (coproduct) in *[C, Set]* |
| Join | Limit (pullback) in *[C, Set]* |
| Type domain | Typing functor to a type category *Ty* |

Crucially, instances on *C* form the topos *[C, Set]* (*C–Set* or *C–inst*), so classical relational algebra appears as a fragment of topos operations [1].

---

## 3. Methodology

Our method is **formal-analytic with worked computational validation**, in the style of [1] and [2]:

1. **Formal development** of schemas, instances, and the three migration functors, proving adjointness from the Kan extension formulae.
2. **Running ETL example**: migrating between an HR schema *S* (*Employee*, *Department*, *worksIn*) and target schemas, computing *Δ*, *Σ*, *Π* on small instances.
3. **Preservation analysis** via type-side functors [2, 8]: migration preserves typing and constraints, and migrations compose.
4. **Empirical grounding** via the FQL/SPCU equivalence theorems [2], complexity analysis, and two ETL case studies (schema evolution, enterprise merger).
5. **Tool correspondence** mapping each construct to CQL/FQL [5, 8] and ologs [3].

All categorical claims are standard consequences of the definitions; theorems proved elsewhere are cited precisely.

---

## 4. Deep Dive

### 4.1 The Functorial Data Model: Schemas, Instances, and Constraints

The HR schema *S* is a directed multigraph with one equation; the schema category *S* is the free category on this graph modulo the equations. An instance *I: S → Set* might assign *I(Employee) = {e₁, e₂}*, *I(Department) = {d₁}*, *I(worksIn)(e₁) = I(worksIn)(e₂) = d₁*. Functoriality guarantees that following a foreign key from a row always lands on a genuine row of the target table — referential integrity as a *theorem* of the representation, not an extra check. Path equations become commuting diagrams every valid instance automatically respects.

```rust
// A schema presentation: a directed multigraph plus path equations
struct Schema {
    objects: Vec<String>,                    // tables / entity types
    arrows: Vec<(String, String, String)>,     // (name, src, tgt): foreign keys
    equations: Vec<(Vec<String>, Vec<String>)>, // commuting paths (constraints)
}

let s = Schema {
    objects: vec!["Employee".into(), "Department".into()],
    arrows: vec![("worksIn".into(), "Employee".into(), "Department".into()),
                 ("manages".into(), "Employee".into(), "Employee".into())],
    equations: vec![(vec!["manages", "worksIn"], vec!["worksIn"])],
};
```

> **Theorem (Topos of instances [1]):** For any small schema category *C*, the category *C–inst = [C, Set]* of instances and natural transformations is a topos. Finite limits compute joins and selections; finite colimits compute unions.

In Haskell-flavored notation, an instance is simply a structure-preserving map:

```haskell
-- An instance assigns a set of rows to each table, functorially
class Schema s where
  type Row s :: * -> *
-- Naturality: for every foreign key f : c -> d, the square commutes
naturality :: Schema s => (c -> d) -> (Row s c -> Row s d)
```

The topos structure makes the model a *denotational semantics* for database theory [1]: every theorem about presheaf categories is a theorem about databases.

### 4.2 The Migration Adjunctions: Δ, Σ, and Π

Let *F: S → T* be a schema morphism (functor). Three functors between instance categories arise canonically [1]:

| Functor | Direction | Definition | Logical reading | SQL analogue |
|---|---|---|---|---|
| *Δ_F* (pullback) | *T–inst → S–inst* | *Δ_F(J) = J ∘ F* | Substitution / restriction | `SELECT` / projection |
| *Σ_F* (left Kan ext.) | *S–inst → T–inst* | *Σ_F ⊣ Δ_F* | Existential: disjoint union along *F* | `UNION ALL` + relabeling |
| *Π_F* (right Kan ext.) | *S–inst → T–inst* | *Δ_F ⊣ Π_F* | Universal: fiberwise product | `JOIN` / correlated subquery |

*Δ_F* is precomposition: given a *T*-instance *J*, *Δ_F(J) = J ∘ F*. If *F* includes one schema into a larger one, *Δ_F* projects away extra tables; if *F* identifies tables, *Δ_F* duplicates data accordingly — the *only* functorial way to pull data back along *F*.

*Σ_F* is the **left Kan extension** of *I* along *F*: pointwise, *Σ_F(I)(t)* is the colimit (disjoint union, quotiented by the schema's equations) of all *I(s)* for tables *s* mapping into *t* — data pushed forward by *unioning* everything landing on each target table, with fresh keys invented for unioned rows (the **key generation** / labeled-null mechanism of [2]). *Π_F* is the **right Kan extension**: *Π_F(I)(t)* is the limit over the comma category *(t ↓ F)* — a fiberwise product, i.e., a **join** of all source tables mapping into *t*.

> **Theorem (Migration adjunctions [1]):** For every schema morphism *F: S → T* there is an adjoint chain *Σ_F ⊣ Δ_F ⊣ Π_F* between *S–inst* and *T–inst*.

The adjointness is not decoration: *Σ_F* is the *freest* way to push an instance forward, *Π_F* the *most constrained*, *Δ_F* the canonical pullback — any other reasonable migration factors through these. Since left adjoints preserve colimits and right adjoints preserve limits: *Σ_F* and *Δ_F* preserve unions; *Δ_F* and *Π_F* preserve joins.

A concrete computation in Python illustrates *Σ* as a quotiented disjoint union with key generation:

```python
def sigma_collapse(instance):
    """Left Kan extension collapsing Employee, Department -> Staff:
    disjoint union of rows, tagged by origin table (a UNION ALL with provenance)."""
    staff_rows, counter = [], [0]
    def fresh():
        counter[0] += 1
        return f"sk{counter[0]}"  # key generation: provably fresh IDs
    for table, rows in instance.items():
        for r in rows:
            staff_rows.append({"id": fresh(), "origin": table, "row": r})
    return staff_rows

I = {"Employee": ["e1", "e2"], "Department": ["d1"]}
for row in sigma_collapse(I):
    print(row)
# {'id': 'sk1', 'origin': 'Employee', 'row': 'e1'} ...  -- a UNION ALL with provenance
```

Dually, *Π* along the collapse map computes the join: *Π_F(I)(Staff)* is the limit over the comma category — pairs *(e, d)* with *I(worksIn)(e) = d*, exactly the relational join of *Employee* with *Department* [2].

### 4.3 Data Integration as Kan Extensions

The migration functors compose, which is what makes them a *query language* rather than a bag of primitives. Given *F: S → T* and *G: T → U*:

> **Theorem (Composition closure [2]):** *Σ_G ∘ Σ_F ≅ Σ_{G∘F}*, *Δ_F ∘ Δ_G ≅ Δ_{G∘F}*, and *Π_G ∘ Π_F ≅ Π_{G∘F}*. FQL queries — finite composites of *Δ*, *Σ*, *Π* — are closed under composition.

In TLA+ the composition law is an invariant over migration pipelines:

```tla+
---- MODULE Migration ----
EXTENDS Naturals, FiniteSets
CONSTANTS SObjs, TObjs, UObjs
VARIABLES inst
Delta(F, J) == [c \in SObjs |-> J[F[c]]]      \* pullback = precomposition
\* Composition closure: S->T then T->U equals migration along G \circ F
ComposeLaw(F, G, I) == Sigma(G, Sigma(F, I)) = Sigma(G @@ F, I)
====
```

Schema *integration* — merging schemas *S₁, S₂* overlapping on a shared schema *O* — is the **pushout** *S₁ +_O S₂* in the category of schemas; migrating the two instances is *Σ* along the inclusions, a Kan extension along a cospan. Overlap duplicates are identified by the colimit's quotient while distinct rows get fresh keys. This gives ETL a universal property: the integrated instance is the *best* instance receiving maps from both sources — a precise correctness criterion hand-written ETL scripts lack.

### 4.4 Preservation, Type-Change Safety, and Integrity

Real databases are typed. In the functorial model, typing is handled by a **type-side** — a distinguished schema *Ty* of datatypes — with a typing functor from each schema into *Ty* [2, 8]; an instance is *well-typed* when it respects this functor:

> **Theorem (Type preservation):** If *F: S → T* is a schema morphism compatible with the type-sides (i.e., the typing functors commute with *F*), then *Δ_F*, *Σ_F*, and *Π_F* all map well-typed instances to well-typed instances.

*Proof sketch.* *Δ_F* is precomposition, so typing commutes definitionally. *Σ_F* builds colimits in **Set**; its fresh keys are of entity (ID) type, never confused with attribute types. *Π_F* builds limits, dually preserved. ∎

Integrity constraints — the path equations — are preserved in a strong sense: because instances are functors, any equation holding in the schema *automatically* holds in every instance, including migrated ones. No separate "constraint checking" phase exists after migration; constraints are *theorems* of the representation. And *Δ_F*, having adjoints on both sides, preserves *all* limits and colimits, so projections never destroy joins or unions in the source data.

A subtle point is **key generation** in *Σ*: unioning rows from different source tables into one target table requires inventing fresh identifiers (Skolem terms / labeled nulls) [2]. These are provably *fresh* — distinct from all existing keys — so *Σ* never accidentally identifies distinct entities. Entity resolution (deciding two source rows denote the same real-world entity) is *not* automatic; it is expressed explicitly as extra path equations in the target schema, cleanly separating mechanical migration from semantic matching.

### 4.5 CQL, FQL, and Ologs: From Theory to Tooling

The theory has been implemented. **FQL** (Functorial Query Language) [2] is the algebraic query language whose programs are composites of *Δ*, *Σ*, *Π* over schema morphisms presented by visual graph mappings. Spivak and Wisnesky prove the central engineering theorems:

> **Theorem (Relational equivalence [2]):** FQL can be implemented in the select-project-product-union algebra **SPCU** extended with key generation, and SPCU can be implemented in FQL. FQL is therefore exactly as expressive as SPCU.

This means every functorial migration compiles to ordinary relational algebra (hence SQL), and every SPCU query arises functorially — the categorical and relational worlds coincide in expressive power while the categorical side adds compositionality and proofs. FQL evolved into **CQL** (Categorical Query Language), an open-source ETL and data migration tool with an IDE by Ryan Wisnesky, executing migrations by translating them to SQL via these theorems [5, 8].

Complementary is **knowledge representation** via **ologs** [3]: an olog is a category whose objects are *types* (labeled boxes with singular indefinite noun phrases like "a person") and whose morphisms are *aspects* (labeled arrows reading as verb phrases like "works in"), with *facts* as commuting diagrams. A university olog has types "an employee", "a department", "a manager", aspects "works in" and "manages", and the pullback "an employee who is a manager". Ologs are schemas with human-readable labels — the same mathematics, presented for communication — and map functorially into database schemas, keeping conceptual models and physical schemas synchronized by construction.

---

## 5. Empirical Evaluation and Proofs

### 5.1 The core theorems, assembled

We collect the proven results that constitute the framework's verified core:

1. **Topos semantics** [1]: *C–inst* is a topos; relational algebra is a fragment of its internal logic.
2. **Migration adjunctions** [1]: every *F* induces *Σ_F ⊣ Δ_F ⊣ Π_F*.
3. **Composition closure** [2]: FQL is closed under composition.
4. **Relational equivalence** [2]: FQL ≡ SPCU + key generation, both directions.
5. **Type preservation** (§4.4): well-typed instances migrate to well-typed instances.

Items 3 and 4 are the *empirical* heart: proved against the standard relational model and validated by a working implementation compiling FQL/CQL to SQL [5, 8].

### 5.2 Worked ETL computation

Take *S* = {*Employee* →(*worksIn*) *Department*} with *I(Employee) = {e₁, e₂}*, *I(Department) = {d₁}*, *worksIn(e₁) = worksIn(e₂) = d₁*, and *F: S → T* collapsing both tables to a single *Staff* table:

- *Σ_F(I)(Staff)* = {*sk₁, sk₂, sk₃*} — disjoint union with provenance tags (a `UNION ALL`).
- *Π_F(I)(Staff)* = {*(e₁, d₁), (e₂, d₁)*} — the limit over the comma category, i.e., the join on *worksIn*.
- For the inclusion *G: DeptOnly → S*, *Δ_G* projects any *S*-instance to its *Department* table — a `SELECT`.

Each result is forced by the universal property; no query text was written, only the schema mapping *F*.

### 5.3 Complexity and implementation

The three functors have sharply different costs. *Δ_F* is precomposition — linear-time relabeling/projection. *Σ_F* is a disjoint union quotiented by the schema's equations — near-linear with union-find, plus fresh-key generation. *Π_F* computes limits, i.e., joins: worst case exponential, but the SPCU translation [2] turns it into ordinary SQL joins run by a mature RDBMS optimizer, with labeled nulls handled by the chase. CQL [8] exploits exactly this: categorical queries in, SQL out, correctness guaranteed by theorem rather than testing.

### 5.4 Case studies

**Schema evolution.** A company renames *Employee* to *Staff* and splits *Department* into *Division*/*Team*: a cospan of schema functors. Migration is *Σ* along the forward map (equations recording the split) and *Δ* backward for rollback; round-trip laws follow from the adjunction triangle identities — a formal guarantee rollback recovers the original data.

**Enterprise merger (HR integration).** Two companies' schemas *S₁*, *S₂* share overlap *O* with functors *O → S₁*, *O → S₂*. The integrated schema is the pushout *S₁ +_O S₂*; instances migrate via *Σ* along the inclusions. Shared departments are identified by the colimit; distinct employees get fresh keys; the result is the *canonical* merge by its universal property. Integration as colimit, migration as Kan extension — the framework's signature contribution to ETL [1, 5].

---

## 6. Limitations

The framework's honesty requires stating its boundaries clearly:

1. **Cost of Π.** Right Kan extensions compute limits (joins); pathological schemas yield exponential blowups. The SQL translation mitigates but does not eliminate this — *Π* remains the expensive migration.
2. **Decidability of equations.** Path equality is the word problem for the presented category — undecidable in general. Tools [8] restrict to confluent rewriting or the chase, which may not terminate on adversarial inputs.
3. **Key generation vs. entity resolution.** *Σ* invents provably fresh keys, but deciding two source rows are the *same* entity needs explicit equations — the framework mechanizes migration, not semantic matching.
4. **Manual schema mappings.** Discovering *F: S → T* remains a creative, domain-expert task; the theory gives a mapping's *meaning*, not its automatic discovery.
5. **Expressiveness gaps.** Core FQL lacks aggregation, arithmetic, and recursion; CQL's extensions are less theoretically settled than the *Δ/Σ/Π* kernel [2, 5].
6. **Adoption barrier.** The categorical prerequisites are a genuine obstacle for working data engineers, and the tooling ecosystem is far less mature than the SQL world's.

---

## 7. Conclusion

Functorial data migration reframes one of data engineering's oldest problems in the language category theory was built for: *migration*. Modeling schemas as categories, instances as Set-valued functors, and mappings as functors, Spivak [1] showed migration is a canonical construction — the pullback *Δ_F* and Kan extensions *Σ_F*, *Π_F* in the chain *Σ_F ⊣ Δ_F ⊣ Π_F*. Spivak and Wisnesky [2] proved it closed under composition and exactly as expressive as SPCU, yielding the FQL/CQL systems [5, 8] that compile categorical queries to SQL, while ologs [3] carry the same mathematics into human-readable knowledge representation.

The deepest lesson is methodological: when the *definitions* are right — schemas as categories, integrity as functoriality — the *theorems* (adjunctions, preservation, compositionality) come for free, and the engineering (SQL compilation, ETL correctness, rollback laws) follows from the theorems rather than from testing. Future work includes probabilistic instances, incremental migration under schema evolution, and automatic discovery of schema functors. The functorial perspective does not replace relational databases; it gives them a compositional semantics worthy of the mathematics they deserve.

## References

[1] David I. Spivak, "Functorial Data Migration," *arXiv:1009.1166 [cs.DB]*, 2010 (revised 2013). https://arxiv.org/abs/1009.1166

[2] David I. Spivak and Ryan Wisnesky, "Relational Foundations for Functorial Data Migration," *arXiv:1212.5303 [cs.DB]*, 2012. https://arxiv.org/abs/1212.5303

[3] David I. Spivak and Robert E. Kent, "Ologs: A Categorical Framework for Knowledge Representation," *PLoS ONE* 7(1): e24274, 2012. https://doi.org/10.1371/journal.pone.0024274

[4] David I. Spivak, *Category Theory for the Sciences*, MIT Press, 2014.

[5] Ryan Wisnesky, "Categorical Query Language," LambdaConf 2019 talk. https://www.categoricaldata.net/cql/lambdaconf.pdf

[6] David I. Spivak, "Categorical Databases," Oracle talk, February 2014. https://dspivak.net/talks/pdfs/20140228-oracle.pdf

[7] Saunders Mac Lane, *Categories for the Working Mathematician*, 2nd ed., Springer, 1998.

[8] Ryan Wisnesky et al., FQL IDE — functorial query language implementation. http://categoricaldata.net/fql.html

