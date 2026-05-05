-- =============================================================
-- CalcuLearn Problem Bank — Full Seed Script
-- Generated from live database
-- Total problems: 206
-- Run: sqlite3 data/calculearn.sqlite < scripts/seed_problems.sql
-- =============================================================

BEGIN TRANSACTION;

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'cont-definition-application-40lo5d',
  'continuity.definition',
  'application',
  'free-response',
  'Use the Intermediate Value Theorem to show that $x^3 - x - 1 = 0$ has a root in $(1, 2)$.',
  '{"raw":"f(1) = -1 < 0 and f(2) = 5 > 0, so by IVT a root exists","latex":"f(1)<0,\\;f(2)>0 \\Rightarrow \\exists\\,c\\in(1,2): f(c)=0","type":"text"}',
  '[{"stepNumber":1,"description":"Evaluate f(1) = 1 − 1 − 1 = −1 < 0","expression":"f(1) = -1","hint":"What is f(1)?"},{"stepNumber":2,"description":"Evaluate f(2) = 8 − 2 − 1 = 5 > 0","expression":"f(2) = 5","hint":"What is f(2)?"},{"stepNumber":3,"description":"Apply IVT: f is continuous, sign changes","expression":"\\exists\\,c \\in (1,2): f(c) = 0","hint":"What does the IVT guarantee when a continuous function changes sign?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'continuity-definition-application-5cf1099',
  'continuity.definition',
  'application',
  'free-response',
  'Use the IVT to show $x^3+2x-5=0$ has a root in $(1,2)$.',
  '{"raw":"f(1)=−2<0 and f(2)=7>0. f is continuous, so IVT gives a root in (1,2).","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"f is continuous","expression":"\\text{polynomial}","hint":"Polynomials are continuous everywhere."},{"stepNumber":2,"description":"Evaluate at endpoints","expression":"f(1)=-2<0,\\; f(2)=7>0","hint":"Substitute x=1 and x=2."},{"stepNumber":3,"description":"Apply IVT","expression":"\\exists c\\in(1,2):f(c)=0","hint":"0 is between −2 and 7."}]',
  '[{"id":"misc-ea6fbe","description":"Thinks IVT gives the exact root value"},{"id":"misc-90953e","description":"Requires f(a)=0 or f(b)=0 to apply IVT"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'cont-definition-conceptual-xw6y9p',
  'continuity.definition',
  'conceptual',
  'explain-concept',
  'State the three conditions required for $f$ to be continuous at $x = a$.',
  '{"raw":"f(a) defined, limit exists, limit equals f(a)","latex":"f(a)\\text{ defined};\\;\\lim_{x\\to a}f(x)\\text{ exists};\\;\\lim_{x\\to a}f(x)=f(a)","type":"text"}',
  '[{"stepNumber":1,"description":"Condition 1: f(a) must be defined","expression":"f(a) \\text{ exists}","hint":"What must be true about the function value at a?"},{"stepNumber":2,"description":"Condition 2: the limit must exist","expression":"\\lim_{x \\to a} f(x) \\text{ exists}","hint":"What must the one-sided limits satisfy?"},{"stepNumber":3,"description":"Condition 3: limit equals function value","expression":"\\lim_{x \\to a} f(x) = f(a)","hint":"How must the limit and function value relate?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'continuity-definition-conceptual-6af7e6c',
  'continuity.definition',
  'conceptual',
  'explain-concept',
  'State the three conditions for $f$ to be continuous at $x=a$.',
  '{"raw":"(1) f(a) exists, (2) lim_{x→a}f(x) exists, (3) lim_{x→a}f(x)=f(a).","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"f(a) must exist","expression":"f(a) \\text{ exists}","hint":"Can you evaluate f at the point?"},{"stepNumber":2,"description":"Limit must exist","expression":"\\lim_{x\\to a}f(x) \\text{ exists}","hint":"Do both one-sided limits agree?"},{"stepNumber":3,"description":"Limit equals function value","expression":"\\lim_{x\\to a}f(x)=f(a)","hint":"Does the limit equal the output?"}]',
  '[{"id":"misc-8a7619","description":"States only that the limit must exist"},{"id":"misc-755745","description":"Confuses differentiability with continuity"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'cont-definition-procedural-mpnan8',
  'continuity.definition',
  'procedural',
  'free-response',
  'Find the value of $c$ that makes $f(x) = \begin{cases} cx + 1 & x \leq 2 \\ x^2 - 1 & x > 2 \end{cases}$ continuous at $x = 2$.',
  '{"raw":"c = 1","latex":"c = 1","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Left-hand limit: c(2) + 1 = 2c + 1","expression":"\\lim_{x \\to 2^-} f(x) = 2c + 1","hint":"Evaluate the top branch at x = 2."},{"stepNumber":2,"description":"Right-hand limit: 4 − 1 = 3","expression":"\\lim_{x \\to 2^+} f(x) = 3","hint":"Evaluate the bottom branch at x = 2."},{"stepNumber":3,"description":"Set equal for continuity: 2c + 1 = 3","expression":"c = 1","hint":"What value of c makes the one-sided limits equal?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'cont-definition-procedural-vj5jf0',
  'continuity.definition',
  'procedural',
  'free-response',
  'Is $f(x) = \dfrac{x^2-4}{x-2}$ continuous at $x = 2$? Explain.',
  '{"raw":"No — f(2) is undefined","latex":"\\text{No — } f(2) \\text{ undefined}","type":"text"}',
  '[{"stepNumber":1,"description":"Check condition 1: f(2) = 0/0 — undefined","expression":"f(2) = \\frac{0}{0} \\text{ undefined}","hint":"Can you substitute x = 2?"},{"stepNumber":2,"description":"Condition 1 fails — not continuous","expression":"\\text{Discontinuity at } x = 2","hint":"If f(a) is undefined, what can you conclude?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'continuity-definition-procedural-413491d',
  'continuity.definition',
  'procedural',
  'free-response',
  'Is $f(x)=\dfrac{x^2-4}{x-2}$ continuous at $x=2$? Classify any discontinuity.',
  '{"raw":"Not continuous; removable discontinuity. lim=4 but f(2) undefined.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"f(2) undefined","expression":"f(2)=0/0","hint":"Substitute x=2."},{"stepNumber":2,"description":"Compute limit","expression":"\\lim_{x\\to 2}\\frac{(x-2)(x+2)}{x-2}=4","hint":"Factor x²−4."},{"stepNumber":3,"description":"Removable discontinuity","expression":"","hint":"Limit exists but f(2) undefined."}]',
  '[{"id":"misc-0b59ac","description":"Concludes f is continuous because the limit exists"},{"id":"misc-fe9375","description":"Misclassifies as jump discontinuity"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'continuity-definition-procedural-a1ce16f',
  'continuity.definition',
  'procedural',
  'free-response',
  'Find $k$ making $f(x)=\begin{cases}kx+2 & x\leq 1\\3x^2-1 & x>1\end{cases}$ continuous at $x=1$.',
  '{"raw":"k=0","latex":"k=0","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Right limit","expression":"\\lim_{x\\to 1^+}(3x^2-1)=2","hint":"Substitute x=1 into second piece."},{"stepNumber":2,"description":"Left limit/f(1)","expression":"k+2=2","hint":"Set equal for continuity."},{"stepNumber":3,"description":"Solve","expression":"k=0","hint":"Simple algebra."}]',
  '[{"id":"misc-be6e3c","description":"Sets pieces equal at x=0 instead of x=1"},{"id":"misc-80cc49","description":"Solves k+2=3 using 3x² without subtracting 1"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'cont-definition-proof-sketch-1ee2o6v',
  'continuity.definition',
  'proof-sketch',
  'free-response',
  'Prove that $f(x) = x^2$ is continuous at every real number $a$.',
  '{"raw":"lim_{x→a} x² = a² = f(a) for all a, so all three continuity conditions hold","latex":"\\lim_{x\\to a}x^2 = a^2 = f(a) \\;\\forall a\\in\\mathbb{R}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"f(a) = a² is defined for all a","expression":"f(a) = a^2 \\in \\mathbb{R}","hint":"Is f(a) defined everywhere?"},{"stepNumber":2,"description":"lim_{x→a} x² = a² (polynomial limit by substitution)","expression":"\\lim_{x\\to a}x^2 = a^2","hint":"How do you evaluate the limit of a polynomial?"},{"stepNumber":3,"description":"Limit equals function value — all three conditions hold","expression":"a^2 = f(a) \\Rightarrow \\text{continuous}","hint":"Check the third condition."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'continuity-definition-proof-sketch-120e6b4',
  'continuity.definition',
  'proof-sketch',
  'free-response',
  'Sketch a proof that every polynomial is continuous on all of $\mathbb{R}$.',
  '{"raw":"Constants and x are continuous; products and sums of continuous functions are continuous; polynomials are finite sums/products of these.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Base cases","expression":"\\lim_{x\\to c}a=a,\\;\\lim_{x\\to c}x=c","hint":"Constants and x are continuous."},{"stepNumber":2,"description":"Product rule","expression":"\\lim[fg]=f(c)g(c)","hint":"Product of continuous functions is continuous."},{"stepNumber":3,"description":"Sum rule","expression":"\\lim[f+g]=f(c)+g(c)","hint":"Sum of continuous functions is continuous."},{"stepNumber":4,"description":"Induction","expression":"a_k x^k \\text{ continuous; finite sum continuous}","hint":"Build up from monomials."}]',
  '[{"id":"misc-b3f31a","description":"Gives one example polynomial instead of proving the general case"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'cont-types-application-1pac9qn',
  'continuity.types',
  'application',
  'free-response',
  'Use the IVT to prove that $\cos x = x$ has at least one solution in $(0, \pi/2)$.',
  '{"raw":"Let g(x) = cos x − x; g(0) = 1 > 0, g(π/2) = −π/2 < 0; by IVT a root exists","latex":"g(0)>0,\\;g(\\pi/2)<0\\Rightarrow\\exists\\,c\\in(0,\\pi/2):g(c)=0","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Define g(x) = cos x − x","expression":"g(x) = \\cos x - x","hint":"Rewrite the equation as g(x) = 0."},{"stepNumber":2,"description":"g(0) = 1 > 0","expression":"g(0) = 1","hint":"Evaluate g at the left endpoint."},{"stepNumber":3,"description":"g(π/2) = 0 − π/2 < 0","expression":"g(\\pi/2) = -\\pi/2","hint":"Evaluate g at the right endpoint."},{"stepNumber":4,"description":"Apply IVT","expression":"\\exists\\,c: g(c) = 0 \\Rightarrow \\cos c = c","hint":"What does the sign change guarantee?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'continuity-types-application-f06f7a9',
  'continuity.types',
  'application',
  'free-response',
  'Use the IVT to show $\cos x = x$ has at least one solution in $(0,\pi/2)$.',
  '{"raw":"g(x)=cos x−x. g(0)=1>0, g(π/2)=−π/2<0. g continuous → IVT gives c∈(0,π/2) with g(c)=0.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Form g(x)=cos x−x","expression":"g(x)=\\cos x-x","hint":"Subtract x from both sides."},{"stepNumber":2,"description":"Evaluate at endpoints","expression":"g(0)=1>0,\\;g(\\pi/2)=-\\pi/2<0","hint":"cos(0)=1, cos(π/2)=0."},{"stepNumber":3,"description":"Apply IVT","expression":"\\exists c\\in(0,\\pi/2):g(c)=0","hint":"0 is between g(0)>0 and g(π/2)<0."}]',
  '[{"id":"misc-6c6c33","description":"Applies IVT to cos x without forming g(x)=cos x−x"},{"id":"misc-84c08d","description":"Concludes c=π/4 from IVT alone"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'cont-types-conceptual-b72ads',
  'continuity.types',
  'conceptual',
  'explain-concept',
  'Describe the difference between a removable discontinuity and a jump discontinuity.',
  '{"raw":"Removable: limit exists but ≠ f(a); Jump: one-sided limits exist but differ","latex":"\\text{Removable: }\\lim f\\text{ exists}\\neq f(a);\\;\\text{Jump: }L^-\\neq L^+","type":"text"}',
  '[{"stepNumber":1,"description":"Removable: limit exists, but equals wrong value or f(a) undefined","expression":"\\lim_{x\\to a}f(x)\\text{ exists, }\\neq f(a)","hint":"Can the discontinuity be \"filled in\" with a single point?"},{"stepNumber":2,"description":"Jump: one-sided limits exist but differ","expression":"L^- \\neq L^+","hint":"What happens to the one-sided limits at a jump?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'continuity-types-conceptual-e46cd92',
  'continuity.types',
  'conceptual',
  'explain-concept',
  'Describe the three types of discontinuity: removable, jump, and infinite.',
  '{"raw":"Removable: hole (limit exists but ≠f(a)). Jump: graph jumps (one-sided limits differ). Infinite: vertical asymptote.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Removable","expression":"\\lim_{x\\to a}f(x)=L\\neq f(a)","hint":"Limit exists but not matched."},{"stepNumber":2,"description":"Jump","expression":"\\lim_{x\\to a^-}f\\neq\\lim_{x\\to a^+}f","hint":"Both one-sided limits exist but differ."},{"stepNumber":3,"description":"Infinite","expression":"\\lim_{x\\to a}f=\\pm\\infty","hint":"Function grows without bound."}]',
  '[{"id":"misc-bb1cb5","description":"Thinks removable discontinuity means the limit does not exist"},{"id":"misc-d02935","description":"Thinks jump discontinuity means neither one-sided limit exists"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'cont-types-procedural-7yhado',
  'continuity.types',
  'procedural',
  'free-response',
  'Classify the discontinuity of $f(x) = \dfrac{x^2-9}{x-3}$ at $x = 3$.',
  '{"raw":"Removable discontinuity","latex":"\\text{Removable discontinuity}","type":"text"}',
  '[{"stepNumber":1,"description":"Factor: (x−3)(x+3)/(x−3) → x+3 for x ≠ 3","expression":"\\lim_{x\\to 3}(x+3) = 6","hint":"What does the limit equal?"},{"stepNumber":2,"description":"f(3) is undefined, but limit exists","expression":"\\text{Removable — redefine } f(3)=6","hint":"Can you remove the discontinuity by defining f(3)?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'cont-types-procedural-urjlhx',
  'continuity.types',
  'procedural',
  'free-response',
  'Classify the discontinuity of $f(x) = \begin{cases} 2x & x < 1 \\ x+3 & x \geq 1 \end{cases}$ at $x = 1$.',
  '{"raw":"Jump discontinuity","latex":"\\text{Jump discontinuity}","type":"text"}',
  '[{"stepNumber":1,"description":"Left limit: 2(1) = 2","expression":"L^- = 2","hint":"Evaluate the left branch at x = 1."},{"stepNumber":2,"description":"Right limit: 1 + 3 = 4","expression":"L^+ = 4","hint":"Evaluate the right branch at x = 1."},{"stepNumber":3,"description":"L⁻ ≠ L⁺ → jump discontinuity","expression":"2 \\neq 4 \\Rightarrow \\text{jump}","hint":"What type of discontinuity occurs when one-sided limits differ?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'continuity-types-procedural-353c7fc',
  'continuity.types',
  'procedural',
  'explain-concept',
  'State the Intermediate Value Theorem precisely.',
  '{"raw":"If f is continuous on [a,b] and N is between f(a) and f(b), then ∃c∈(a,b) with f(c)=N.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Hypothesis","expression":"f \\text{ continuous on } [a,b]","hint":"What must be true about f?"},{"stepNumber":2,"description":"Conclusion","expression":"\\forall N \\text{ between } f(a),f(b),\\exists c\\in(a,b):f(c)=N","hint":"What does IVT guarantee?"},{"stepNumber":3,"description":"IVT is existential, not constructive","expression":"","hint":"Does IVT find c?"}]',
  '[{"id":"misc-017f3c","description":"Thinks IVT provides the exact value of c"},{"id":"misc-0881b9","description":"Applies IVT to discontinuous functions"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'continuity-types-procedural-f498d28',
  'continuity.types',
  'procedural',
  'free-response',
  'Classify the discontinuity of $f(x)=\dfrac{1}{(x-3)^2}$ at $x=3$.',
  '{"raw":"Infinite discontinuity (vertical asymptote at x=3)","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"f(3) undefined","expression":"f(3)=1/0","hint":"Denominator is 0."},{"stepNumber":2,"description":"Both one-sided limits are +∞","expression":"\\lim_{x\\to 3}1/(x-3)^2=+\\infty","hint":"(x−3)²>0 near x=3."},{"stepNumber":3,"description":"Infinite discontinuity","expression":"","hint":"Limit is ±∞, not finite."}]',
  '[{"id":"misc-f49d82","description":"Thinks factoring removes the discontinuity"},{"id":"misc-f850b4","description":"Classifies as jump because two sides are considered"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'cont-types-proof-sketch-1s3k0sm',
  'continuity.types',
  'proof-sketch',
  'free-response',
  'Prove the Intermediate Value Theorem: if $f$ is continuous on $[a,b]$ and $f(a) < 0 < f(b)$, then there exists $c \in (a,b)$ with $f(c) = 0$. (Sketch the key idea using the bisection argument.)',
  '{"raw":"Bisect [a,b]; the midpoint m satisfies f(m) < 0 or f(m) > 0; recurse on the half where sign changes; the nested intervals converge to c with f(c) = 0 by continuity","latex":"\\text{Bisection: nested intervals }[a_n,b_n]\\to c,\\;f(c)=0","type":"text"}',
  '[{"stepNumber":1,"description":"Let m = (a+b)/2; if f(m) = 0 done; else sign changes on [a,m] or [m,b]","expression":"m = \\frac{a+b}{2}","hint":"What are the cases for f(m)?"},{"stepNumber":2,"description":"Recurse: produce nested intervals [aₙ,bₙ] with bₙ−aₙ → 0","expression":"b_n - a_n = \\frac{b-a}{2^n} \\to 0","hint":"How do the interval lengths shrink?"},{"stepNumber":3,"description":"By completeness, aₙ → c; by continuity f(c) = lim f(aₙ) = 0","expression":"f(c) = \\lim_{n\\to\\infty}f(a_n) = 0","hint":"Use continuity to pass the limit through f."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'continuity-types-proof-sketch-fd617e1',
  'continuity.types',
  'proof-sketch',
  'free-response',
  'Prove: if $f$ continuous on $[a,b]$ and $f(a)<0<f(b)$, then $f$ has a zero in $(a,b)$.',
  '{"raw":"This is IVT with N=0. Since 0 is between f(a)<0 and f(b)>0, IVT gives c∈(a,b) with f(c)=0.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Identify N=0","expression":"f(a)<0<f(b) \\Rightarrow 0 \\text{ is between } f(a) \\text{ and } f(b)","hint":"What value of N does IVT use?"},{"stepNumber":2,"description":"Apply IVT","expression":"\\exists c\\in(a,b):f(c)=0","hint":"State IVT and apply it."},{"stepNumber":3,"description":"Conclude","expression":"f(c)=0 \\Rightarrow c \\text{ is a zero}","hint":"What does f(c)=0 mean?"}]',
  '[{"id":"misc-2274b5","description":"Thinks the function must already be zero at an endpoint"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-chain-rule-application-7912051',
  'deriv.chain-rule',
  'application',
  'free-response',
  'Differentiate $y=e^{x^2+1}$.',
  '{"raw":"y''=2xe^{x^2+1}","latex":"y''=2xe^{x^2+1}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Outer=eᵘ, inner=x²+1","expression":"f''(u)=e^u","hint":"d/du(eᵘ)=eᵘ."},{"stepNumber":2,"description":"Inner derivative","expression":"u''=2x","hint":"d/dx(x²+1)=2x."},{"stepNumber":3,"description":"Chain rule","expression":"e^{x^2+1}\\cdot 2x","hint":"Outer times inner."}]',
  '[{"id":"misc-718b3b","description":"Writes e^{2x} — differentiates the exponent and puts it back"},{"id":"misc-bc01a2","description":"Writes e^{x^2+1} without the 2x factor"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-chain-rule-application-ov5qxo',
  'deriv.chain-rule',
  'application',
  'free-response',
  'Differentiate $f(x) = e^{\sin x}$.',
  '{"raw":"cos(x) * e^(sin(x))","latex":"e^{\\sin x}\\cos x","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Outer: eᵘ, inner: u = sin x","expression":"\\frac{d}{du}[e^u] = e^u","hint":"What is the derivative of eᵘ?"},{"stepNumber":2,"description":"Inner derivative: cos x","expression":"g''(x) = \\cos x","hint":"Differentiate sin x."},{"stepNumber":3,"description":"Chain rule","expression":"e^{\\sin x} \\cdot \\cos x","hint":"Multiply f''(g(x)) by g''(x)."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-chain-rule-conceptual-6cb5z0',
  'deriv.chain-rule',
  'conceptual',
  'explain-concept',
  'State the chain rule for $\dfrac{d}{dx}[f(g(x))]$.',
  '{"raw":"f''(g(x)) * g''(x)","latex":"f''(g(x)) \\cdot g''(x)","type":"text"}',
  '[{"stepNumber":1,"description":"Identify outer function f and inner function g","expression":"f(g(x))","hint":"Which function is applied last (outer)?"},{"stepNumber":2,"description":"State the chain rule","expression":"\\frac{d}{dx}[f(g(x))] = f''(g(x)) \\cdot g''(x)","hint":"Multiply the derivative of the outer (evaluated at the inner) by the derivative of the inner."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-chain-rule-conceptual-ce22201',
  'deriv.chain-rule',
  'conceptual',
  'explain-concept',
  'State the chain rule in both prime and Leibniz notation.',
  '{"raw":"Prime: (f∘g)''(x)=f''(g(x))·g''(x). Leibniz: dy/dx=(dy/du)·(du/dx).","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Prime notation","expression":"(f\\circ g)''(x)=f''(g(x))\\cdot g''(x)","hint":"Derivative of outer times derivative of inner."},{"stepNumber":2,"description":"Leibniz notation","expression":"\\frac{dy}{dx}=\\frac{dy}{du}\\cdot\\frac{du}{dx}","hint":"The du ''cancels'' symbolically."},{"stepNumber":3,"description":"Identify outer and inner","expression":"y=f(u),\\;u=g(x)","hint":"u is the inner function."}]',
  '[{"id":"misc-fcd8c6","description":"Computes f''(g(x)) but forgets to multiply by g''(x)"},{"id":"misc-384adf","description":"Confuses chain rule with product rule"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-chain-rule-procedural-1dlts9h',
  'deriv.chain-rule',
  'procedural',
  'free-response',
  'Differentiate $h(x) = \sin(x^3)$.',
  '{"raw":"3x^2 * cos(x^3)","latex":"3x^2\\cos(x^3)","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Outer: sin(u), inner: u = x³","expression":"\\frac{d}{du}[\\sin u] = \\cos u","hint":"What is the derivative of sin(u)?"},{"stepNumber":2,"description":"Inner derivative: 3x²","expression":"g''(x) = 3x^2","hint":"Differentiate x³."},{"stepNumber":3,"description":"Chain rule","expression":"\\cos(x^3) \\cdot 3x^2","hint":"Multiply f''(g(x)) by g''(x)."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-chain-rule-procedural-ac655b6',
  'deriv.chain-rule',
  'procedural',
  'free-response',
  'Differentiate $y=(2x^3+1)^4$.',
  '{"raw":"y''=24x^2(2x^3+1)^3","latex":"y''=24x^2(2x^3+1)^3","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Outer: u⁴, inner: u=2x³+1","expression":"f''(u)=4u^3","hint":"Power rule on outer."},{"stepNumber":2,"description":"Inner derivative","expression":"u''=6x^2","hint":"d/dx(2x³+1)=6x²."},{"stepNumber":3,"description":"Chain rule","expression":"4(2x^3+1)^3\\cdot 6x^2=24x^2(2x^3+1)^3","hint":"Outer times inner."}]',
  '[{"id":"misc-94f440","description":"Writes 4(2x³+1)³ without the 6x² factor"},{"id":"misc-48ef89","description":"Decreases power but changes the base"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-chain-rule-procedural-f5d4e81',
  'deriv.chain-rule',
  'procedural',
  'free-response',
  'Find $\dfrac{d}{dx}[\cos(x^2)]$.',
  '{"raw":"-2x sin(x^2)","latex":"-2x\\sin(x^2)","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Outer=cos, inner=x²","expression":"f''(u)=-\\sin u","hint":"d/du(cos u)=−sin u."},{"stepNumber":2,"description":"Inner derivative","expression":"u''=2x","hint":"d/dx(x²)=2x."},{"stepNumber":3,"description":"Chain rule","expression":"-\\sin(x^2)\\cdot 2x=-2x\\sin(x^2)","hint":"Outer times inner."}]',
  '[{"id":"misc-820f89","description":"Writes −sin(x²) without the 2x factor"},{"id":"misc-918596","description":"Writes −2x·sin(2x) — differentiates inside the cosine"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-chain-rule-procedural-m6iqvw',
  'deriv.chain-rule',
  'procedural',
  'free-response',
  'Differentiate $y = (3x^2 + 1)^5$.',
  '{"raw":"10x*(3x^2+1)^4 * 3 = 30x*(3x^2+1)^4","latex":"30x(3x^2+1)^4","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Outer: u⁵, inner: u = 3x²+1","expression":"f(u) = u^5,\\; g(x) = 3x^2+1","hint":"What is the outer function?"},{"stepNumber":2,"description":"f''(u) = 5u⁴, g''(x) = 6x","expression":"5(3x^2+1)^4 \\cdot 6x","hint":"Differentiate outer and inner separately."},{"stepNumber":3,"description":"Simplify","expression":"30x(3x^2+1)^4","hint":"Multiply the constants."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-chain-rule-proof-sketch-1h01xgg',
  'deriv.chain-rule',
  'proof-sketch',
  'free-response',
  'Sketch a proof of the chain rule $\dfrac{d}{dx}[f(g(x))] = f''(g(x))g''(x)$ using the limit definition (informal version).',
  '{"raw":"Write Δy/Δx = (Δy/Δu)·(Δu/Δx); take Δx→0; note Δu→0 so Δy/Δu→f''(u)","latex":"\\frac{\\Delta y}{\\Delta x} = \\frac{\\Delta y}{\\Delta u}\\cdot\\frac{\\Delta u}{\\Delta x} \\to f''(g(x))g''(x)","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Let u = g(x), y = f(u); write Δy/Δx = (Δy/Δu)·(Δu/Δx)","expression":"\\frac{\\Delta y}{\\Delta x} = \\frac{\\Delta y}{\\Delta u}\\cdot\\frac{\\Delta u}{\\Delta x}","hint":"Multiply and divide by Δu."},{"stepNumber":2,"description":"As Δx → 0: Δu → 0 (g continuous), Δu/Δx → g''(x)","expression":"\\frac{\\Delta u}{\\Delta x} \\to g''(x)","hint":"What does Δu/Δx approach?"},{"stepNumber":3,"description":"Δy/Δu → f''(u) = f''(g(x))","expression":"\\frac{\\Delta y}{\\Delta u} \\to f''(g(x))","hint":"What does Δy/Δu approach as Δu → 0?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-chain-rule-proof-sketch-ef9913e',
  'deriv.chain-rule',
  'proof-sketch',
  'free-response',
  'Derive $\dfrac{d}{dx}[\ln(f(x))]=\dfrac{f''(x)}{f(x)}$ using the chain rule.',
  '{"raw":"Outer: ln u, inner: f(x). d/du(ln u)=1/u. Chain rule: (1/f(x))·f''(x)=f''(x)/f(x).","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Set u=f(x), outer=ln u","expression":"\\frac{d}{dx}\\ln(f(x))=\\frac{d}{du}(\\ln u)\\cdot\\frac{du}{dx}","hint":"Apply chain rule."},{"stepNumber":2,"description":"Differentiate outer","expression":"\\frac{d}{du}(\\ln u)=\\frac{1}{u}","hint":"d/du(ln u)=1/u."},{"stepNumber":3,"description":"Substitute back","expression":"\\frac{1}{f(x)}\\cdot f''(x)=\\frac{f''(x)}{f(x)}","hint":"Replace u with f(x)."}]',
  '[{"id":"misc-d18805","description":"Writes 1/f(x) without multiplying by f''(x)"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-implicit-application-1lwwcuw',
  'deriv.implicit',
  'application',
  'free-response',
  'Find the slope of the tangent to $x^2 + y^2 = 25$ at the point $(3, 4)$.',
  '{"raw":"-3/4","latex":"-\\dfrac{3}{4}","type":"numeric"}',
  '[{"stepNumber":1,"description":"dy/dx = −x/y","expression":"\\frac{dy}{dx} = -\\frac{x}{y}","hint":"Use the result from implicit differentiation."},{"stepNumber":2,"description":"Substitute (3, 4)","expression":"-\\frac{3}{4}","hint":"Plug in x = 3, y = 4."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-implicit-application-8bd34db',
  'deriv.implicit',
  'application',
  'free-response',
  'Find the slope of the tangent to $x^2+xy+y^2=7$ at $(1,2)$.',
  '{"raw":"-4/5","latex":"-\\dfrac{4}{5}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Differentiate implicitly","expression":"2x+y+xy''+2yy''=0","hint":"Product rule on xy."},{"stepNumber":2,"description":"Solve for y''","expression":"y''=\\frac{-2x-y}{x+2y}","hint":"Collect y'' terms."},{"stepNumber":3,"description":"Substitute (1,2)","expression":"y''=\\frac{-2-2}{1+4}=-4/5","hint":"x=1, y=2."}]',
  '[{"id":"misc-18976b","description":"Differentiates xy as y instead of y+xy''"},{"id":"misc-6c2d2a","description":"Substitutes x=1,y=2 before isolating y''"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-implicit-conceptual-3c85cff',
  'deriv.implicit',
  'conceptual',
  'explain-concept',
  'Explain when implicit differentiation is necessary and how it differs from explicit differentiation.',
  '{"raw":"Implicit differentiation is used when y cannot be solved explicitly for x, or when doing so is inconvenient. Differentiate both sides with respect to x, applying the chain rule to y terms.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"When explicit form is unavailable","expression":"x^2+y^2=1 \\text{ — hard to solve for y uniquely}","hint":"Can you always isolate y?"},{"stepNumber":2,"description":"Differentiate both sides","expression":"\\frac{d}{dx}[F(x,y)]=\\frac{d}{dx}[G(x,y)]","hint":"Treat x as independent variable."},{"stepNumber":3,"description":"Chain rule on y terms","expression":"\\frac{d}{dx}[y^2]=2y\\frac{dy}{dx}","hint":"y is a function of x."}]',
  '[{"id":"misc-a57b5d","description":"Differentiates y terms without multiplying by dy/dx"},{"id":"misc-6d74c8","description":"Thinks implicit differentiation only applies to circles"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-implicit-conceptual-ojotxl',
  'deriv.implicit',
  'conceptual',
  'explain-concept',
  'Why do we use implicit differentiation for $x^2 + y^2 = 25$?',
  '{"raw":"Because y is not explicitly solved for as a function of x","latex":"\\text{y is not isolated; differentiate both sides w.r.t. x}","type":"text"}',
  '[{"stepNumber":1,"description":"y is defined implicitly","expression":"x^2 + y^2 = 25","hint":"Can you easily solve for y as a single function of x?"},{"stepNumber":2,"description":"Differentiate both sides with respect to x, treating y as a function of x","expression":"2x + 2y\\frac{dy}{dx} = 0","hint":"What rule applies when differentiating y²?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-implicit-procedural-1l8fp4a',
  'deriv.implicit',
  'procedural',
  'free-response',
  'Find $\dfrac{dy}{dx}$ for $x^2 + y^2 = 25$.',
  '{"raw":"-x/y","latex":"-\\dfrac{x}{y}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Differentiate both sides","expression":"2x + 2y\\frac{dy}{dx} = 0","hint":"Apply d/dx to both sides, using the chain rule on y²."},{"stepNumber":2,"description":"Solve for dy/dx","expression":"\\frac{dy}{dx} = -\\frac{x}{y}","hint":"Isolate dy/dx."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-implicit-procedural-67b05f3',
  'deriv.implicit',
  'procedural',
  'free-response',
  'Use implicit differentiation to find $y''$ for $x^3+y^3=9$.',
  '{"raw":"y''=-x^2/y^2","latex":"y''=-\\dfrac{x^2}{y^2}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Differentiate both sides","expression":"3x^2+3y^2y''=0","hint":"Chain rule on y³."},{"stepNumber":2,"description":"Solve","expression":"y''=-x^2/y^2","hint":"Isolate y''."}]',
  '[{"id":"misc-1cab43","description":"Writes 3x²+3y²=0 without y''"},{"id":"misc-d18440","description":"Gets x²/y² without the negative sign"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-implicit-procedural-c9fc74f',
  'deriv.implicit',
  'procedural',
  'free-response',
  'Find $\dfrac{dy}{dx}$ for $x^2+y^2=25$.',
  '{"raw":"dy/dx=-x/y","latex":"\\dfrac{dy}{dx}=-\\dfrac{x}{y}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Differentiate both sides","expression":"2x+2y\\frac{dy}{dx}=0","hint":"d/dx(y²)=2y·dy/dx."},{"stepNumber":2,"description":"Solve for dy/dx","expression":"\\frac{dy}{dx}=-\\frac{x}{y}","hint":"Isolate dy/dx."}]',
  '[{"id":"misc-36bc12","description":"Writes 2x+2y=0 without the dy/dx factor"},{"id":"misc-68dfe6","description":"Gets x/y without the negative sign"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-implicit-procedural-xzwq8',
  'deriv.implicit',
  'procedural',
  'free-response',
  'Find $\dfrac{dy}{dx}$ for $x^3 + y^3 = 6xy$.',
  '{"raw":"(2y - x^2) / (y^2 - 2x)","latex":"\\dfrac{2y - x^2}{y^2 - 2x}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Differentiate both sides","expression":"3x^2 + 3y^2\\frac{dy}{dx} = 6y + 6x\\frac{dy}{dx}","hint":"Use the product rule on 6xy."},{"stepNumber":2,"description":"Collect dy/dx terms","expression":"(3y^2 - 6x)\\frac{dy}{dx} = 6y - 3x^2","hint":"Move all dy/dx terms to one side."},{"stepNumber":3,"description":"Solve","expression":"\\frac{dy}{dx} = \\frac{6y-3x^2}{3y^2-6x} = \\frac{2y-x^2}{y^2-2x}","hint":"Divide and simplify."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-implicit-proof-sketch-f6ed3ed',
  'deriv.implicit',
  'proof-sketch',
  'free-response',
  'Derive $\dfrac{d}{dx}[\arcsin x]=\dfrac{1}{\sqrt{1-x^2}}$ using implicit differentiation.',
  '{"raw":"Let y=arcsin x, so sin y=x. Differentiate: cos y·dy/dx=1. Thus dy/dx=1/cos y=1/√(1−x²).","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Write inverse relation","expression":"\\sin y=x","hint":"What does arcsin x mean?"},{"stepNumber":2,"description":"Differentiate both sides","expression":"\\cos y\\cdot\\frac{dy}{dx}=1","hint":"Chain rule on sin y."},{"stepNumber":3,"description":"Solve","expression":"\\frac{dy}{dx}=\\frac{1}{\\cos y}","hint":"Isolate dy/dx."},{"stepNumber":4,"description":"Use Pythagorean identity","expression":"\\cos y=\\sqrt{1-x^2}","hint":"sin y=x, so sin²y=x²."}]',
  '[{"id":"misc-a998ae","description":"Thinks d/dx(arcsin x)=cos x"},{"id":"misc-7145a7","description":"Leaves the answer as 1/cos y without substituting √(1−x²)"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-implicit-proof-sketch-gn2dfj',
  'deriv.implicit',
  'proof-sketch',
  'free-response',
  'Explain why implicit differentiation is valid: why can we differentiate both sides of $F(x, y) = 0$ with respect to $x$?',
  '{"raw":"By the implicit function theorem, y is locally a differentiable function of x near a point where F_y ≠ 0; differentiating both sides applies the chain rule to y(x)","latex":"F_y \\neq 0 \\Rightarrow y = y(x) \\text{ locally; chain rule applies}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"The implicit function theorem guarantees y = y(x) locally when F_y ≠ 0","expression":"F_y(x_0, y_0) \\neq 0 \\Rightarrow \\exists y(x)","hint":"What condition ensures y is a function of x?"},{"stepNumber":2,"description":"Differentiating F(x, y(x)) = 0 applies the chain rule","expression":"F_x + F_y \\frac{dy}{dx} = 0","hint":"Apply d/dx to both sides using the chain rule on y."},{"stepNumber":3,"description":"Solve for dy/dx","expression":"\\frac{dy}{dx} = -\\frac{F_x}{F_y}","hint":"Isolate dy/dx."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-optimisation-application-0740655',
  'deriv.optimisation',
  'application',
  'free-response',
  'Find the point on $y=x^2$ closest to $(0,3)$.',
  '{"raw":"(±1/√2, 1/2)","latex":"\\left(\\pm\\dfrac{1}{\\sqrt{2}},\\dfrac{1}{2}\\right)","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Distance squared","expression":"D^2=x^2+(x^2-3)^2","hint":"Minimize D² to avoid square root."},{"stepNumber":2,"description":"Expand and differentiate","expression":"D^2=x^4-5x^2+9,\\;\\frac{d(D^2)}{dx}=4x^3-10x","hint":"Expand (x²−3)²."},{"stepNumber":3,"description":"Set to zero","expression":"2x(2x^2-5)=0\\Rightarrow x=0 \\text{ or } x^2=5/2","hint":"Factor."},{"stepNumber":4,"description":"x=0 gives local max of distance","expression":"x=\\pm\\sqrt{5/2},\\;y=5/2","hint":"Verify using second derivative."}]',
  '[{"id":"misc-a3d96c","description":"Differentiates √(x²+(x²−3)²) directly"},{"id":"misc-6d3750","description":"Assumes x=0 is the closest point"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-optimisation-application-1mkvkz0',
  'deriv.optimisation',
  'application',
  'free-response',
  'A farmer has 200 m of fencing to enclose a rectangular field against a barn wall (no fence needed on one side). What dimensions maximise the area?',
  '{"raw":"Width = 50 m, Length = 100 m","latex":"w = 50\\text{ m},\\; l = 100\\text{ m}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Constraint: 2w + l = 200 → l = 200 − 2w","expression":"l = 200 - 2w","hint":"Write the fencing constraint."},{"stepNumber":2,"description":"Area: A = wl = w(200 − 2w) = 200w − 2w²","expression":"A(w) = 200w - 2w^2","hint":"Substitute l into A = wl."},{"stepNumber":3,"description":"A''(w) = 200 − 4w = 0 → w = 50","expression":"w = 50","hint":"Set A''(w) = 0 and solve."},{"stepNumber":4,"description":"l = 200 − 100 = 100","expression":"l = 100","hint":"Find l from the constraint."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-optimisation-conceptual-1qqxba',
  'deriv.optimisation',
  'conceptual',
  'explain-concept',
  'What is a critical point, and why are critical points important for optimisation?',
  '{"raw":"A point where f''(x) = 0 or f''(x) is undefined; extrema can only occur at critical points or endpoints","latex":"f''(c)=0 \\text{ or undefined}; \\text{ extrema occur at critical points/endpoints}","type":"text"}',
  '[{"stepNumber":1,"description":"Define critical point: f''(c) = 0 or f''(c) undefined","expression":"f''(c) = 0 \\text{ or DNE}","hint":"What condition defines a critical point?"},{"stepNumber":2,"description":"Extrema can only occur at critical points or endpoints","expression":"\\text{Extreme Value Theorem}","hint":"Where can a continuous function on a closed interval attain its max/min?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-optimisation-conceptual-eb298a1',
  'deriv.optimisation',
  'conceptual',
  'explain-concept',
  'Explain the first and second derivative tests for classifying critical points.',
  '{"raw":"First: if f'' changes + to −, local max; − to +, local min. Second: if f''(c)=0 and f''''(c)<0, local max; f''''(c)>0, local min; f''''(c)=0, inconclusive.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Find critical points","expression":"f''(c)=0 \\text{ or DNE}","hint":"Where can extrema occur?"},{"stepNumber":2,"description":"First derivative test","expression":"f''>0\\to f''<0 \\Rightarrow \\text{local max}","hint":"Sign change of f'' determines type."},{"stepNumber":3,"description":"Second derivative test","expression":"f''(c)=0,f''''(c)<0\\Rightarrow\\text{local max}","hint":"Concavity at the critical point."}]',
  '[{"id":"misc-09731d","description":"Thinks every critical point is a local extremum"},{"id":"misc-f7f973","description":"Applies second derivative test when f''''(c)=0 and draws a conclusion"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-optimisation-procedural-1wa8257',
  'deriv.optimisation',
  'procedural',
  'free-response',
  'Find the absolute maximum and minimum of $f(x) = x^3 - 3x$ on $[-2, 2]$.',
  '{"raw":"Max: 2 at x = -1; Min: -2 at x = 1","latex":"\\text{Max } 2 \\text{ at } x=-1;\\; \\text{Min } -2 \\text{ at } x=1","type":"symbolic"}',
  '[{"stepNumber":1,"description":"f''(x) = 3x² − 3 = 0 → x = ±1","expression":"x = \\pm 1","hint":"Set f''(x) = 0 and solve."},{"stepNumber":2,"description":"Evaluate at critical points and endpoints","expression":"f(-2)=-2,\\;f(-1)=2,\\;f(1)=-2,\\;f(2)=2","hint":"Compute f at x = −2, −1, 1, 2."},{"stepNumber":3,"description":"Identify max and min","expression":"\\text{Max } 2,\\; \\text{Min } -2","hint":"Which value is largest? Smallest?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-optimisation-procedural-a048a18',
  'deriv.optimisation',
  'procedural',
  'free-response',
  'A farmer has 200 m of fencing to enclose a rectangular field against a river (no fence along river). Find dimensions maximizing area.',
  '{"raw":"Width=50 m, length=100 m, max area=5000 m²","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Constraint: 2w+l=200","expression":"l=200-2w","hint":"Only three sides need fencing."},{"stepNumber":2,"description":"Area function","expression":"A(w)=w(200-2w)=200w-2w^2","hint":"A=w·l."},{"stepNumber":3,"description":"Maximize","expression":"A''=200-4w=0\\Rightarrow w=50","hint":"Set A''=0."},{"stepNumber":4,"description":"Find l and A","expression":"l=100,\\;A=5000","hint":"Substitute w=50."}]',
  '[{"id":"misc-403e78","description":"Uses 2w+2l=200 instead of 2w+l=200"},{"id":"misc-47907a","description":"Maximizes A=wl without using the fencing constraint"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-optimisation-procedural-a1776e3',
  'deriv.optimisation',
  'procedural',
  'free-response',
  'Find the absolute maximum and minimum of $f(x)=x^3-3x$ on $[-2,2]$.',
  '{"raw":"Abs max=2 at x=-1 and x=2; abs min=-2 at x=1 and x=-2","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Find critical points","expression":"f''=3x^2-3=0\\Rightarrow x=\\pm 1","hint":"Set f''=0."},{"stepNumber":2,"description":"Evaluate at critical points and endpoints","expression":"f(-2)=-2,f(-1)=2,f(1)=-2,f(2)=2","hint":"Check all candidates."},{"stepNumber":3,"description":"Identify extrema","expression":"\\text{Max}=2,\\text{ Min}=-2","hint":"Largest and smallest values."}]',
  '[{"id":"misc-be635e","description":"Only checks critical points, ignores endpoints"},{"id":"misc-b1665d","description":"Assumes critical point with largest value is absolute maximum"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-optimisation-proof-sketch-5d33c36',
  'deriv.optimisation',
  'proof-sketch',
  'free-response',
  'Prove that among all rectangles with fixed perimeter $P$, the square has the maximum area.',
  '{"raw":"Let sides be x and P/2−x. A=x(P/2−x). A''=P/2−2x=0 gives x=P/4. A''''=−2<0 confirms max. Both sides equal P/4 → square.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Express one side in terms of the other","expression":"y=P/2-x","hint":"Perimeter constraint."},{"stepNumber":2,"description":"Area function","expression":"A(x)=x(P/2-x)","hint":"A=xy."},{"stepNumber":3,"description":"Maximize","expression":"A''=P/2-2x=0\\Rightarrow x=P/4","hint":"Set A''=0."},{"stepNumber":4,"description":"Verify and identify shape","expression":"A''''=-2<0;\\;y=P/4=x\\Rightarrow\\text{square}","hint":"Both sides equal P/4."}]',
  '[{"id":"misc-d9e458","description":"Uses AM-GM without connecting to calculus optimization"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-optimisation-proof-sketch-vsihcz',
  'deriv.optimisation',
  'proof-sketch',
  'free-response',
  'Prove that among all rectangles with a fixed perimeter P, the square has the maximum area.',
  '{"raw":"Let sides be x and P/2 - x; A = x(P/2 - x); A'' = 0 gives x = P/4; both sides equal P/4","latex":"x = P/4 \\Rightarrow \\text{square maximises area}","type":"text"}',
  '[{"stepNumber":1,"description":"Let one side be x; other side is P/2 − x","expression":"A(x) = x\\left(\\frac{P}{2}-x\\right)","hint":"Express area as a function of one variable."},{"stepNumber":2,"description":"A''(x) = P/2 − 2x = 0 → x = P/4","expression":"x = P/4","hint":"Set A''(x) = 0."},{"stepNumber":3,"description":"Both sides equal P/4 — a square","expression":"\\text{Square: } x = \\frac{P}{2}-x = \\frac{P}{4}","hint":"What shape has all sides equal?"},{"stepNumber":4,"description":"A''''(x) = −2 < 0 confirms maximum","expression":"A''''(x) = -2 < 0","hint":"Use the second derivative test."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-power-rule-application-1aadn82',
  'deriv.power-rule',
  'application',
  'free-response',
  'Find the equation of the tangent line to $y = x^3 - 2x$ at $x = 1$.',
  '{"raw":"y = x - 2","latex":"y = x - 2","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Find the slope: y'' = 3x² − 2; at x = 1: m = 1","expression":"y''(1) = 3(1)^2 - 2 = 1","hint":"Differentiate and evaluate at x = 1."},{"stepNumber":2,"description":"Find the point: y(1) = 1 − 2 = −1","expression":"(1, -1)","hint":"What is y when x = 1?"},{"stepNumber":3,"description":"Point-slope form","expression":"y - (-1) = 1(x - 1) \\Rightarrow y = x - 2","hint":"Use y − y₁ = m(x − x₁)."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-power-rule-application-3e930a0',
  'deriv.power-rule',
  'application',
  'free-response',
  'Find the equation of the tangent line to $y=x^3-x$ at $x=1$.',
  '{"raw":"y=2x-2","latex":"y=2x-2","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Find point","expression":"y(1)=0\\Rightarrow(1,0)","hint":"Substitute x=1."},{"stepNumber":2,"description":"Find slope","expression":"y''=3x^2-1,\\;y''(1)=2","hint":"Differentiate and evaluate."},{"stepNumber":3,"description":"Point-slope form","expression":"y=2(x-1)=2x-2","hint":"y−y₁=m(x−x₁)."}]',
  '[{"id":"misc-24647e","description":"Uses (0,0) as the point instead of (1,0)"},{"id":"misc-683b72","description":"Uses y(1)=0 as the slope"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-power-rule-conceptual-0a81401',
  'deriv.power-rule',
  'conceptual',
  'explain-concept',
  'Explain why the derivative of a constant function $f(x)=c$ is zero.',
  '{"raw":"f''(x)=lim_{h→0}(c−c)/h=0. A constant does not change.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Limit definition","expression":"f''(x)=\\lim_{h\\to 0}\\frac{f(x+h)-f(x)}{h}","hint":"Start from the definition."},{"stepNumber":2,"description":"Substitute f(x)=c","expression":"\\frac{c-c}{h}=0","hint":"f(x+h)=c for all h."},{"stepNumber":3,"description":"Take limit","expression":"\\lim_{h\\to 0}0=0","hint":"Limit of 0 is 0."}]',
  '[{"id":"misc-5c0d12","description":"Thinks derivative of c is c"},{"id":"misc-beed50","description":"Thinks d/dx(c)=1 by analogy with d/dx(x)=1"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-power-rule-conceptual-xii59u',
  'deriv.power-rule',
  'conceptual',
  'explain-concept',
  'State the power rule for differentiation.',
  '{"raw":"d/dx[x^n] = n*x^(n-1)","latex":"\\dfrac{d}{dx}[x^n] = nx^{n-1}","type":"text"}',
  '[{"stepNumber":1,"description":"State the rule","expression":"\\frac{d}{dx}[x^n] = nx^{n-1}","hint":"What happens to the exponent and coefficient?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-power-rule-procedural-566fd10',
  'deriv.power-rule',
  'procedural',
  'free-response',
  'Differentiate $f(x)=5x^4-3x^2+7$.',
  '{"raw":"f''(x)=20x^3-6x","latex":"f''(x)=20x^3-6x","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Power rule on each term","expression":"\\frac{d}{dx}(5x^4)=20x^3","hint":"d/dx(axⁿ)=naxⁿ⁻¹."},{"stepNumber":2,"description":"Continue","expression":"\\frac{d}{dx}(-3x^2)=-6x,\\;\\frac{d}{dx}(7)=0","hint":"Constant vanishes."},{"stepNumber":3,"description":"Combine","expression":"20x^3-6x","hint":"Sum the terms."}]',
  '[{"id":"misc-3d4808","description":"Writes 4x³ instead of 20x³ (forgets coefficient)"},{"id":"misc-f7829b","description":"Differentiates 7 to get 7 or 1 instead of 0"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-power-rule-procedural-c0fb873',
  'deriv.power-rule',
  'procedural',
  'free-response',
  'Find $\dfrac{d}{dx}\left(x^{-2}+\sqrt[3]{x}\right)$.',
  '{"raw":"-2x^{-3}+(1/3)x^{-2/3}","latex":"-2x^{-3}+\\dfrac{1}{3}x^{-2/3}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Rewrite ∛x as x^{1/3}","expression":"x^{-2}+x^{1/3}","hint":"Convert radical to fractional exponent."},{"stepNumber":2,"description":"Power rule on x^{−2}","expression":"\\frac{d}{dx}(x^{-2})=-2x^{-3}","hint":"d/dx(xⁿ)=nxⁿ⁻¹; n=−2."},{"stepNumber":3,"description":"Power rule on x^{1/3}","expression":"\\frac{d}{dx}(x^{1/3})=\\frac{1}{3}x^{-2/3}","hint":"n=1/3; n−1=−2/3."}]',
  '[{"id":"misc-2e257c","description":"Writes derivative of ∛x as 1/3 (constant)"},{"id":"misc-af4757","description":"Drops negative sign when applying power rule to x^{−2}"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-power-rule-procedural-dd4xwm',
  'deriv.power-rule',
  'procedural',
  'free-response',
  'Find $\dfrac{dy}{dx}$ if $y = \sqrt{x} + \dfrac{1}{x^2}$.',
  '{"raw":"1/(2*sqrt(x)) - 2/x^3","latex":"\\dfrac{1}{2\\sqrt{x}} - \\dfrac{2}{x^3}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Rewrite as powers: x^(1/2) + x^(−2)","expression":"x^{1/2} + x^{-2}","hint":"How do you write √x and 1/x² using exponents?"},{"stepNumber":2,"description":"Apply power rule","expression":"\\frac{1}{2}x^{-1/2} - 2x^{-3}","hint":"Apply d/dx[xⁿ] = nxⁿ⁻¹ to each term."},{"stepNumber":3,"description":"Rewrite","expression":"\\frac{1}{2\\sqrt{x}} - \\frac{2}{x^3}","hint":"Convert back to radical/fraction form."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-power-rule-procedural-nzpthj',
  'deriv.power-rule',
  'procedural',
  'free-response',
  'Find $f''(x)$ if $f(x) = 4x^3 - 2x^2 + 5x - 7$.',
  '{"raw":"12x^2 - 4x + 5","latex":"12x^2 - 4x + 5","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Differentiate term by term","expression":"\\frac{d}{dx}[4x^3] = 12x^2","hint":"Apply the power rule to each term."},{"stepNumber":2,"description":"Continue","expression":"\\frac{d}{dx}[-2x^2] = -4x","hint":"What is the derivative of −2x²?"},{"stepNumber":3,"description":"Constant term vanishes","expression":"f''(x) = 12x^2 - 4x + 5","hint":"What is the derivative of a constant?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-power-rule-proof-sketch-16b4fuw',
  'deriv.power-rule',
  'proof-sketch',
  'free-response',
  'Prove the power rule $\dfrac{d}{dx}[x^n] = nx^{n-1}$ for positive integers $n$ using the limit definition.',
  '{"raw":"Use the binomial theorem: (x+h)^n = x^n + nx^(n-1)h + O(h²); subtract x^n, divide by h, take h→0","latex":"\\lim_{h\\to 0}\\frac{(x+h)^n - x^n}{h} = nx^{n-1}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Write the difference quotient","expression":"\\frac{(x+h)^n - x^n}{h}","hint":"Start from the definition of the derivative."},{"stepNumber":2,"description":"Expand (x+h)ⁿ by the binomial theorem","expression":"(x+h)^n = x^n + nx^{n-1}h + \\binom{n}{2}x^{n-2}h^2 + \\cdots","hint":"Apply the binomial theorem."},{"stepNumber":3,"description":"Cancel x^n, divide by h, take h → 0","expression":"\\lim_{h\\to 0}\\left(nx^{n-1} + \\binom{n}{2}x^{n-2}h + \\cdots\\right) = nx^{n-1}","hint":"All terms with h vanish."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-power-rule-proof-sketch-c9f52a8',
  'deriv.power-rule',
  'proof-sketch',
  'free-response',
  'Derive the power rule $\dfrac{d}{dx}(x^n)=nx^{n-1}$ for positive integer $n$.',
  '{"raw":"Use the binomial theorem: (x+h)ⁿ=xⁿ+nxⁿ⁻¹h+O(h²). Cancel xⁿ, divide by h, take limit: nxⁿ⁻¹.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Write limit definition","expression":"\\frac{d}{dx}x^n=\\lim_{h\\to 0}\\frac{(x+h)^n-x^n}{h}","hint":"Start from the definition."},{"stepNumber":2,"description":"Expand via binomial theorem","expression":"(x+h)^n=x^n+nx^{n-1}h+\\binom{n}{2}x^{n-2}h^2+\\cdots","hint":"Write out first two terms."},{"stepNumber":3,"description":"Subtract xⁿ and divide by h","expression":"nx^{n-1}+O(h)","hint":"Every remaining term has h."},{"stepNumber":4,"description":"Take limit","expression":"nx^{n-1}","hint":"All terms with h vanish."}]',
  '[{"id":"misc-2b0ced","description":"Verifies for n=2 and n=3 but does not prove the general case"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-product-rule-application-59afaca',
  'deriv.product-rule',
  'application',
  'free-response',
  'Find all $x$ where $g(x)=xe^x$ has a horizontal tangent line.',
  '{"raw":"x=-1","latex":"x=-1","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Differentiate","expression":"g''(x)=e^x+xe^x=e^x(1+x)","hint":"Product rule; eˣ>0 always."},{"stepNumber":2,"description":"Set g''=0","expression":"e^x(1+x)=0","hint":"When is a product zero?"},{"stepNumber":3,"description":"Solve","expression":"x=-1","hint":"eˣ is never 0."}]',
  '[{"id":"misc-c4505b","description":"Sets eˣ=0 and concludes no solution"},{"id":"misc-47d66d","description":"Writes g''=e^x only, missing the xe^x term"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-product-rule-application-ckb72z',
  'deriv.product-rule',
  'application',
  'free-response',
  'Find all x where $h(x) = x^2 e^x$ has a horizontal tangent.',
  '{"raw":"x = 0 and x = -2","latex":"x = 0 \\text{ and } x = -2","type":"text"}',
  '[{"stepNumber":1,"description":"h''(x) = 2xe^x + x^2 e^x = xe^x(2+x)","expression":"h''(x) = xe^x(2+x)","hint":"Apply the product rule, then factor."},{"stepNumber":2,"description":"Set h''(x) = 0: xe^x(2+x) = 0","expression":"x = 0 \\text{ or } x = -2","hint":"eˣ is never zero — what are the other factors?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-product-rule-conceptual-d935351',
  'deriv.product-rule',
  'conceptual',
  'explain-concept',
  'Why is $\dfrac{d}{dx}[f(x)g(x)]\neq f''(x)g''(x)$? Give a counterexample.',
  '{"raw":"Let f=x, g=x. Then fg=x², (fg)''=2x. But f''g''=1·1=1≠2x.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Choose counterexample","expression":"f(x)=x,\\;g(x)=x","hint":"Simplest non-constant functions."},{"stepNumber":2,"description":"Compute (fg)''","expression":"(x^2)''=2x","hint":"What is the derivative of x²?"},{"stepNumber":3,"description":"Compare f''g''","expression":"1\\cdot 1=1\\neq 2x","hint":"1≠2x, so the naive rule fails."}]',
  '[{"id":"misc-42e59d","description":"Believes (fg)''=f''g''"},{"id":"misc-4f8d23","description":"Confuses product rule with chain rule"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-product-rule-conceptual-fxbfbm',
  'deriv.product-rule',
  'conceptual',
  'explain-concept',
  'State the product rule.',
  '{"raw":"(uv)'' = u''v + uv''","latex":"(uv)'' = u''v + uv''","type":"text"}',
  '[{"stepNumber":1,"description":"State the formula","expression":"\\frac{d}{dx}[u \\cdot v] = u''v + uv''","hint":"How do you differentiate a product of two functions?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-product-rule-procedural-1473eb4',
  'deriv.product-rule',
  'procedural',
  'free-response',
  'Find $\dfrac{d}{dx}[x^3\ln x]$.',
  '{"raw":"x^2(3ln x+1)","latex":"x^2(3\\ln x+1)","type":"symbolic"}',
  '[{"stepNumber":1,"description":"u=x³, v=ln x","expression":"u''=3x^2,\\;v''=1/x","hint":"d/dx(ln x)=1/x."},{"stepNumber":2,"description":"Apply product rule","expression":"3x^2\\ln x+x^3\\cdot(1/x)=3x^2\\ln x+x^2","hint":"u''v+uv''."},{"stepNumber":3,"description":"Factor","expression":"x^2(3\\ln x+1)","hint":"Factor out x²."}]',
  '[{"id":"misc-89bd67","description":"Uses d/dx(ln x)=1 instead of 1/x"},{"id":"misc-e2ef07","description":"Forgets the 3x²·ln x term"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-product-rule-procedural-1f9nhdj',
  'deriv.product-rule',
  'procedural',
  'free-response',
  'Differentiate $g(x) = (3x^2 + 1)(x^3 - 2x)$.',
  '{"raw":"6x*(x^3-2x) + (3x^2+1)*(3x^2-2)","latex":"6x(x^3-2x)+(3x^2+1)(3x^2-2)","type":"symbolic"}',
  '[{"stepNumber":1,"description":"u = 3x²+1, v = x³−2x","expression":"u'' = 6x,\\; v'' = 3x^2-2","hint":"Differentiate each factor."},{"stepNumber":2,"description":"Apply product rule","expression":"6x(x^3-2x)+(3x^2+1)(3x^2-2)","hint":"Apply u''v + uv''."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-product-rule-procedural-1v80mn',
  'deriv.product-rule',
  'procedural',
  'free-response',
  'Differentiate $f(x) = x^2 \sin x$.',
  '{"raw":"2x*sin(x) + x^2*cos(x)","latex":"2x\\sin x + x^2\\cos x","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Identify u = x², v = sin x","expression":"u = x^2,\\; v = \\sin x","hint":"Which two functions are being multiplied?"},{"stepNumber":2,"description":"u'' = 2x, v'' = cos x","expression":"u'' = 2x,\\; v'' = \\cos x","hint":"Differentiate each factor."},{"stepNumber":3,"description":"Apply product rule","expression":"2x\\sin x + x^2\\cos x","hint":"Now apply u''v + uv''."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-product-rule-procedural-8fac5c2',
  'deriv.product-rule',
  'procedural',
  'free-response',
  'Differentiate $h(x)=(x^3+2)(x^2-5)$ using the product rule.',
  '{"raw":"h''(x)=5x^4-15x^2+4x","latex":"h''(x)=5x^4-15x^2+4x","type":"symbolic"}',
  '[{"stepNumber":1,"description":"u=x³+2, v=x²−5","expression":"u''=3x^2,\\;v''=2x","hint":"Differentiate each factor."},{"stepNumber":2,"description":"Apply product rule","expression":"3x^2(x^2-5)+(x^3+2)(2x)","hint":"u''v+uv''."},{"stepNumber":3,"description":"Expand","expression":"3x^4-15x^2+2x^4+4x=5x^4-15x^2+4x","hint":"Combine like terms."}]',
  '[{"id":"misc-1d12af","description":"Writes only u''v and forgets uv''"},{"id":"misc-6a9cca","description":"Writes u''v'' instead of u''v+uv''"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-product-rule-proof-sketch-7pv8jd',
  'deriv.product-rule',
  'proof-sketch',
  'free-response',
  'Prove the product rule $(uv)'' = u''v + uv''$ from the limit definition.',
  '{"raw":"Add and subtract u(x+h)v(x) in the numerator; factor and take h→0","latex":"\\lim_{h\\to 0}\\frac{u(x+h)v(x+h)-u(x)v(x)}{h} = u''v + uv''","type":"text"}',
  '[{"stepNumber":1,"description":"Write the difference quotient for uv","expression":"\\frac{u(x+h)v(x+h)-u(x)v(x)}{h}","hint":"Start from the definition."},{"stepNumber":2,"description":"Add and subtract u(x+h)v(x)","expression":"\\frac{u(x+h)v(x+h)-u(x+h)v(x)+u(x+h)v(x)-u(x)v(x)}{h}","hint":"What term can you add and subtract to split the expression?"},{"stepNumber":3,"description":"Factor and take h → 0","expression":"u(x+h)\\cdot\\frac{v(x+h)-v(x)}{h} + v(x)\\cdot\\frac{u(x+h)-u(x)}{h} \\to u v'' + v u''","hint":"Recognise the derivative definitions."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-product-rule-proof-sketch-9ff4b4c',
  'deriv.product-rule',
  'proof-sketch',
  'free-response',
  'Prove the product rule $(fg)''=f''g+fg''$ from the limit definition.',
  '{"raw":"Add and subtract f(x+h)g(x) in the numerator, split into two fractions, and take the limit.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Limit definition","expression":"\\lim_{h\\to 0}\\frac{f(x+h)g(x+h)-f(x)g(x)}{h}","hint":"Start from the definition."},{"stepNumber":2,"description":"Add and subtract f(x+h)g(x)","expression":"\\frac{f(x+h)g(x+h)-f(x+h)g(x)+f(x+h)g(x)-f(x)g(x)}{h}","hint":"Key algebraic trick."},{"stepNumber":3,"description":"Split and factor","expression":"f(x+h)\\frac{g(x+h)-g(x)}{h}+g(x)\\frac{f(x+h)-f(x)}{h}","hint":"Group first two and last two terms."},{"stepNumber":4,"description":"Take limit","expression":"f(x)g''(x)+g(x)f''(x)","hint":"f(x+h)→f(x) by continuity."}]',
  '[{"id":"misc-e80d24","description":"Tries to split the limit directly without the add-and-subtract trick"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-quotient-rule-application-26ccda3',
  'deriv.quotient-rule',
  'application',
  'free-response',
  'Find the equation of the tangent line to $y=\dfrac{\ln x}{x}$ at $x=e$.',
  '{"raw":"y=1/e","latex":"y=\\dfrac{1}{e}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Find point","expression":"y(e)=1/e","hint":"ln(e)=1."},{"stepNumber":2,"description":"Derivative","expression":"y''=\\frac{1-\\ln x}{x^2}","hint":"Quotient rule."},{"stepNumber":3,"description":"Slope at x=e","expression":"y''(e)=0","hint":"ln(e)=1, so numerator=0."},{"stepNumber":4,"description":"Tangent line","expression":"y=1/e","hint":"Horizontal tangent through (e,1/e)."}]',
  '[{"id":"misc-89bd67","description":"Uses d/dx(ln x)=1 instead of 1/x"},{"id":"misc-b09cee","description":"Uses the y-value 1/e as the slope"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-quotient-rule-application-xad50e',
  'deriv.quotient-rule',
  'application',
  'free-response',
  'Find the critical points of $f(x) = \dfrac{x}{x^2+1}$.',
  '{"raw":"x = 1 and x = -1","latex":"x = \\pm 1","type":"text"}',
  '[{"stepNumber":1,"description":"f''(x) = (x²+1 − 2x²)/(x²+1)² = (1−x²)/(x²+1)²","expression":"f''(x) = \\frac{1-x^2}{(x^2+1)^2}","hint":"Apply the quotient rule and simplify."},{"stepNumber":2,"description":"Set numerator = 0: 1 − x² = 0","expression":"x = \\pm 1","hint":"The denominator is never zero — set the numerator to zero."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-quotient-rule-conceptual-1tsyra6',
  'deriv.quotient-rule',
  'conceptual',
  'explain-concept',
  'State the quotient rule.',
  '{"raw":"(u/v)'' = (u''v - uv'') / v^2","latex":"\\left(\\dfrac{u}{v}\\right)'' = \\dfrac{u''v - uv''}{v^2}","type":"text"}',
  '[{"stepNumber":1,"description":"State the formula","expression":"\\frac{d}{dx}\\left[\\frac{u}{v}\\right] = \\frac{u''v - uv''}{v^2}","hint":"How do you differentiate a quotient?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-quotient-rule-conceptual-ee721e4',
  'deriv.quotient-rule',
  'conceptual',
  'explain-concept',
  'State the quotient rule and give the ''low d-high minus high d-low'' mnemonic.',
  '{"raw":"(u/v)''=(u''v−uv'')/v². Mnemonic: low d-high minus high d-low, over low squared.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Formula","expression":"\\left(\\frac{u}{v}\\right)''=\\frac{u''v-uv''}{v^2}","hint":"Which term is subtracted from which?"},{"stepNumber":2,"description":"Mnemonic","expression":"\\text{low}=v,\\text{high}=u","hint":"''low'' is denominator, ''high'' is numerator."},{"stepNumber":3,"description":"Order matters","expression":"u''v-uv'' \\neq uv''-u''v","hint":"Swapping changes the sign."}]',
  '[{"id":"misc-764d23","description":"Writes uv''−u''v instead of u''v−uv''"},{"id":"misc-e902a9","description":"Divides by v instead of v²"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-quotient-rule-procedural-10kpm6m',
  'deriv.quotient-rule',
  'procedural',
  'free-response',
  'Differentiate $g(x) = \dfrac{\sin x}{x}$.',
  '{"raw":"(x*cos(x) - sin(x)) / x^2","latex":"\\dfrac{x\\cos x - \\sin x}{x^2}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"u = sin x, v = x","expression":"u''=\\cos x,\\;v''=1","hint":"Identify u and v."},{"stepNumber":2,"description":"Apply quotient rule","expression":"\\frac{x\\cos x - \\sin x}{x^2}","hint":"Apply (u''v − uv'')/v²."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-quotient-rule-procedural-18aa233',
  'deriv.quotient-rule',
  'procedural',
  'free-response',
  'Find $\dfrac{d}{dx}\left[\dfrac{e^x}{x^2+1}\right]$.',
  '{"raw":"e^x(x-1)^2/(x^2+1)^2","latex":"\\dfrac{e^x(x-1)^2}{(x^2+1)^2}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"u=eˣ, v=x²+1","expression":"u''=e^x,\\;v''=2x","hint":"Derivative of eˣ is eˣ."},{"stepNumber":2,"description":"Quotient rule","expression":"\\frac{e^x(x^2+1)-e^x(2x)}{(x^2+1)^2}","hint":"u''v−uv''."},{"stepNumber":3,"description":"Factor eˣ","expression":"\\frac{e^x(x^2-2x+1)}{(x^2+1)^2}=\\frac{e^x(x-1)^2}{(x^2+1)^2}","hint":"Factor the quadratic."}]',
  '[{"id":"misc-149647","description":"Uses power rule on eˣ: writes xe^{x-1}"},{"id":"misc-22a028","description":"Writes addition instead of subtraction in numerator"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-quotient-rule-procedural-20uca1',
  'deriv.quotient-rule',
  'procedural',
  'free-response',
  'Differentiate $f(x) = \dfrac{x^2 + 1}{x - 3}$.',
  '{"raw":"(x^2 - 6x - 1) / (x-3)^2","latex":"\\dfrac{x^2 - 6x - 1}{(x-3)^2}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"u = x²+1, v = x−3; u'' = 2x, v'' = 1","expression":"u''=2x,\\;v''=1","hint":"Identify and differentiate u and v."},{"stepNumber":2,"description":"Apply quotient rule","expression":"\\frac{2x(x-3)-(x^2+1)(1)}{(x-3)^2}","hint":"Apply (u''v − uv'')/v²."},{"stepNumber":3,"description":"Simplify numerator","expression":"\\frac{2x^2-6x-x^2-1}{(x-3)^2} = \\frac{x^2-6x-1}{(x-3)^2}","hint":"Expand and collect like terms."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-quotient-rule-procedural-ee21083',
  'deriv.quotient-rule',
  'procedural',
  'free-response',
  'Differentiate $f(x)=\dfrac{x^2+1}{x-2}$.',
  '{"raw":"f''(x)=(x^2-4x-1)/(x-2)^2","latex":"f''(x)=\\dfrac{x^2-4x-1}{(x-2)^2}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"u=x²+1, v=x−2","expression":"u''=2x,\\;v''=1","hint":"Differentiate numerator and denominator."},{"stepNumber":2,"description":"Quotient rule","expression":"\\frac{2x(x-2)-(x^2+1)}{(x-2)^2}","hint":"u''v−uv'' over v²."},{"stepNumber":3,"description":"Expand","expression":"2x^2-4x-x^2-1=x^2-4x-1","hint":"Combine like terms."}]',
  '[{"id":"misc-85dffd","description":"Writes +(x²+1) in numerator instead of −(x²+1)"},{"id":"misc-4f0a5e","description":"Uses (x−2) instead of (x−2)² in denominator"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-quotient-rule-proof-sketch-1d251w',
  'deriv.quotient-rule',
  'proof-sketch',
  'free-response',
  'Derive the quotient rule from the product rule.',
  '{"raw":"Write u = (u/v)·v; differentiate both sides using the product rule; solve for (u/v)''","latex":"\\left(\\frac{u}{v}\\right)'' = \\frac{u''v - uv''}{v^2}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Write u = (u/v)·v and differentiate","expression":"u'' = \\left(\\frac{u}{v}\\right)''v + \\frac{u}{v}v''","hint":"Apply the product rule to (u/v)·v."},{"stepNumber":2,"description":"Solve for (u/v)''","expression":"\\left(\\frac{u}{v}\\right)'' = \\frac{u'' - (u/v)v''}{v} = \\frac{u''v - uv''}{v^2}","hint":"Isolate (u/v)'' and multiply through by 1/v."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-quotient-rule-proof-sketch-cdba372',
  'deriv.quotient-rule',
  'proof-sketch',
  'free-response',
  'Derive the quotient rule from the product rule.',
  '{"raw":"Write f/g=f·g⁻¹. Apply product rule: (f·g⁻¹)''=f''g⁻¹+f(−g⁻²g'')=(f''g−fg'')/g².","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Rewrite","expression":"\\frac{f}{g}=f\\cdot g^{-1}","hint":"Express division as multiplication."},{"stepNumber":2,"description":"Product rule","expression":"(f\\cdot g^{-1})''=f''g^{-1}+f(g^{-1})''","hint":"(uv)''=u''v+uv''."},{"stepNumber":3,"description":"Compute (g⁻¹)''","expression":"(g^{-1})''=-g^{-2}g''","hint":"Chain rule on g⁻¹."},{"stepNumber":4,"description":"Simplify","expression":"\\frac{f''g-fg''}{g^2}","hint":"Multiply through by g²/g²."}]',
  '[{"id":"misc-efbab0","description":"Forgets chain rule when differentiating g⁻¹"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-related-rates-application-05cd77c',
  'deriv.related-rates',
  'application',
  'free-response',
  'Two cars leave the same point. Car A goes north at 60 mph; Car B goes east at 80 mph. How fast is the distance between them increasing after 1 hour?',
  '{"raw":"100 mph","latex":"100\\text{ mph}","type":"numeric"}',
  '[{"stepNumber":1,"description":"z²=x²+y²","expression":"z^2=x^2+y^2","hint":"Pythagorean theorem."},{"stepNumber":2,"description":"After 1 hour: x=80, y=60, z=100","expression":"z=\\sqrt{6400+3600}=100","hint":"3-4-5 triangle scaled by 20."},{"stepNumber":3,"description":"Differentiate","expression":"2z\\frac{dz}{dt}=2x\\frac{dx}{dt}+2y\\frac{dy}{dt}","hint":"Implicit differentiation."},{"stepNumber":4,"description":"Substitute and solve","expression":"200\\frac{dz}{dt}=2(80)(80)+2(60)(60)=20000\\Rightarrow 100","hint":"dx/dt=80, dy/dt=60."}]',
  '[{"id":"misc-5d17d5","description":"Uses z=x+y instead of z²=x²+y²"},{"id":"misc-0c0ec8","description":"Substitutes x=80, y=60 before differentiating"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-related-rates-application-oxdiot',
  'deriv.related-rates',
  'application',
  'free-response',
  'Water drains from a conical tank (radius 3 m, height 6 m, vertex down) at 2 m³/min. How fast is the water level falling when h = 3 m?',
  '{"raw":"-8/(9π) m/min","latex":"-\\dfrac{8}{9\\pi}\\text{ m/min}","type":"text"}',
  '[{"stepNumber":1,"description":"Similar triangles: r/h = 3/6 → r = h/2","expression":"r = \\frac{h}{2}","hint":"Use similar triangles to express r in terms of h."},{"stepNumber":2,"description":"V = (1/3)π(h/2)²h = πh³/12","expression":"V = \\frac{\\pi h^3}{12}","hint":"Substitute r = h/2 into V = (1/3)πr²h."},{"stepNumber":3,"description":"dV/dt = (π/4)h²(dh/dt)","expression":"\\frac{dV}{dt} = \\frac{\\pi h^2}{4}\\frac{dh}{dt}","hint":"Differentiate with respect to t."},{"stepNumber":4,"description":"Substitute dV/dt = −2, h = 3","expression":"-2 = \\frac{9\\pi}{4}\\frac{dh}{dt} \\Rightarrow \\frac{dh}{dt} = -\\frac{8}{9\\pi}","hint":"Plug in and solve."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-related-rates-conceptual-1017z01',
  'deriv.related-rates',
  'conceptual',
  'explain-concept',
  'What is the key strategy for solving a related-rates problem?',
  '{"raw":"Write an equation relating the quantities, then differentiate with respect to time","latex":"\\text{Relate quantities, then differentiate w.r.t. } t","type":"text"}',
  '[{"stepNumber":1,"description":"Identify all changing quantities and their rates","expression":"x(t),\\; y(t),\\; \\frac{dx}{dt},\\; \\frac{dy}{dt}","hint":"What quantities are changing with time?"},{"stepNumber":2,"description":"Write a geometric or physical equation relating them","expression":"f(x, y) = c","hint":"What equation connects the quantities?"},{"stepNumber":3,"description":"Differentiate both sides with respect to t","expression":"\\frac{d}{dt}[f(x,y)] = 0","hint":"Use implicit differentiation with respect to t."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-related-rates-conceptual-c68f79d',
  'deriv.related-rates',
  'conceptual',
  'explain-concept',
  'Describe the general strategy for solving a related-rates problem in 4 steps.',
  '{"raw":"(1) Identify quantities and rates. (2) Write an equation relating them. (3) Differentiate with respect to t. (4) Substitute known values and solve.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Draw diagram and label","expression":"","hint":"What quantities are changing?"},{"stepNumber":2,"description":"Write geometric equation","expression":"A=\\pi r^2,\\;V=\\frac{4}{3}\\pi r^3","hint":"What formula connects the variables?"},{"stepNumber":3,"description":"Differentiate with respect to t","expression":"\\frac{dA}{dt}=2\\pi r\\frac{dr}{dt}","hint":"Every variable is a function of t."},{"stepNumber":4,"description":"Substitute after differentiating","expression":"","hint":"Plug in values after differentiating, not before."}]',
  '[{"id":"misc-2c5c8f","description":"Substitutes specific values before differentiating"},{"id":"misc-d69395","description":"Differentiates with respect to spatial variable instead of t"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-related-rates-procedural-12v42m0',
  'deriv.related-rates',
  'procedural',
  'free-response',
  'A ladder 10 m long leans against a wall. The bottom slides away at 2 m/s. How fast is the top sliding down when the bottom is 6 m from the wall?',
  '{"raw":"-3/2 m/s","latex":"-\\dfrac{3}{2}\\text{ m/s}","type":"text"}',
  '[{"stepNumber":1,"description":"Pythagorean relation: x² + y² = 100","expression":"x^2 + y^2 = 100","hint":"Draw the right triangle. What equation relates x and y?"},{"stepNumber":2,"description":"Differentiate: 2x(dx/dt) + 2y(dy/dt) = 0","expression":"2x\\frac{dx}{dt} + 2y\\frac{dy}{dt} = 0","hint":"Differentiate both sides with respect to t."},{"stepNumber":3,"description":"At x = 6: y = 8; dx/dt = 2","expression":"2(6)(2) + 2(8)\\frac{dy}{dt} = 0","hint":"Find y using the Pythagorean theorem, then substitute."},{"stepNumber":4,"description":"Solve: dy/dt = −3/2","expression":"\\frac{dy}{dt} = -\\frac{3}{2}","hint":"Solve for dy/dt."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-related-rates-procedural-1ozar2f',
  'deriv.related-rates',
  'procedural',
  'free-response',
  'A spherical balloon is inflated at 10 cm³/s. How fast is the radius increasing when r = 5 cm?',
  '{"raw":"1/(10π) cm/s","latex":"\\dfrac{1}{10\\pi}\\text{ cm/s}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Volume: V = (4/3)πr³","expression":"V = \\frac{4}{3}\\pi r^3","hint":"What is the formula for the volume of a sphere?"},{"stepNumber":2,"description":"Differentiate: dV/dt = 4πr²(dr/dt)","expression":"\\frac{dV}{dt} = 4\\pi r^2 \\frac{dr}{dt}","hint":"Differentiate with respect to t."},{"stepNumber":3,"description":"Substitute dV/dt = 10, r = 5","expression":"10 = 4\\pi(25)\\frac{dr}{dt}","hint":"Plug in the known values."},{"stepNumber":4,"description":"Solve","expression":"\\frac{dr}{dt} = \\frac{10}{100\\pi} = \\frac{1}{10\\pi}","hint":"Isolate dr/dt."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-related-rates-procedural-a07c531',
  'deriv.related-rates',
  'procedural',
  'free-response',
  'A 13 ft ladder leans against a wall. The bottom slides away at 5 ft/s. How fast is the top sliding down when the bottom is 5 ft from the wall?',
  '{"raw":"-25/12 ft/s","latex":"-\\dfrac{25}{12}\\text{ ft/s}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Pythagorean: x²+y²=169","expression":"x^2+y^2=169","hint":"13²=169."},{"stepNumber":2,"description":"Differentiate","expression":"2x\\frac{dx}{dt}+2y\\frac{dy}{dt}=0","hint":"Implicit differentiation."},{"stepNumber":3,"description":"Find y when x=5","expression":"y=\\sqrt{169-25}=12","hint":"Pythagorean theorem."},{"stepNumber":4,"description":"Substitute","expression":"2(5)(5)+2(12)\\frac{dy}{dt}=0\\Rightarrow\\frac{dy}{dt}=-25/12","hint":"dx/dt=5."}]',
  '[{"id":"misc-39fb28","description":"Substitutes x=5 before differentiating"},{"id":"misc-25738c","description":"Uses area formula instead of Pythagorean"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-related-rates-procedural-b3d074d',
  'deriv.related-rates',
  'procedural',
  'free-response',
  'A sphere is inflated at 50 cm³/s. Find the rate of increase of the radius when $r=10$ cm.',
  '{"raw":"1/(8π) cm/s","latex":"\\dfrac{1}{8\\pi}\\text{ cm/s}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"V=(4/3)πr³","expression":"V=\\frac{4}{3}\\pi r^3","hint":"Volume of sphere."},{"stepNumber":2,"description":"Differentiate","expression":"\\frac{dV}{dt}=4\\pi r^2\\frac{dr}{dt}","hint":"Chain rule."},{"stepNumber":3,"description":"Substitute","expression":"50=4\\pi(100)\\frac{dr}{dt}\\Rightarrow\\frac{dr}{dt}=\\frac{1}{8\\pi}","hint":"r=10, dV/dt=50."}]',
  '[{"id":"misc-67bb97","description":"Uses V=4πr² (surface area) instead of (4/3)πr³"},{"id":"misc-812319","description":"Differentiates V=(4/3)πr³ to 4πr² without dr/dt"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-related-rates-proof-sketch-0ffb4c5',
  'deriv.related-rates',
  'proof-sketch',
  'free-response',
  'A conical tank (vertex down) has height 10 m and radius 4 m. Water drains at 2 m³/min. Find $dh/dt$ when $h=5$ m.',
  '{"raw":"dh/dt=−1/(2π) m/min","latex":"\\dfrac{dh}{dt}=-\\dfrac{1}{2\\pi}\\text{ m/min}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Similar triangles: r=2h/5","expression":"\\frac{r}{h}=\\frac{4}{10}","hint":"Radius-to-height ratio is constant."},{"stepNumber":2,"description":"Volume in terms of h","expression":"V=\\frac{4\\pi h^3}{75}","hint":"Substitute r=2h/5 into V=(1/3)πr²h."},{"stepNumber":3,"description":"Differentiate","expression":"\\frac{dV}{dt}=\\frac{4\\pi h^2}{25}\\frac{dh}{dt}","hint":"Chain rule."},{"stepNumber":4,"description":"Substitute","expression":"−2=4\\pi\\frac{dh}{dt}\\Rightarrow\\frac{dh}{dt}=-\\frac{1}{2\\pi}","hint":"dV/dt=−2, h=5."}]',
  '[{"id":"misc-8009b7","description":"Differentiates V=(1/3)πr²h treating r and h as independent"},{"id":"misc-c2bed6","description":"Uses V=πr²h (cylinder) instead of V=(1/3)πr²h"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'deriv-related-rates-proof-sketch-xnjzy4',
  'deriv.related-rates',
  'proof-sketch',
  'free-response',
  'A point moves along the curve $y = x^2$. Show that the rate of change of the distance from the origin satisfies $\dfrac{ds}{dt} = \dfrac{x(1+2x^2)}{\sqrt{x^2+x^4}}\dfrac{dx}{dt}$.',
  '{"raw":"ds/dt = (x + 2x^3) / sqrt(x^2 + x^4) * dx/dt","latex":"\\frac{ds}{dt} = \\frac{x(1+2x^2)}{\\sqrt{x^2+x^4}}\\frac{dx}{dt}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"s² = x² + y² = x² + x⁴","expression":"s^2 = x^2 + x^4","hint":"Write the distance formula and substitute y = x²."},{"stepNumber":2,"description":"Differentiate: 2s(ds/dt) = (2x + 4x³)(dx/dt)","expression":"2s\\frac{ds}{dt} = (2x+4x^3)\\frac{dx}{dt}","hint":"Differentiate both sides with respect to t."},{"stepNumber":3,"description":"Divide by 2s = 2√(x²+x⁴)","expression":"\\frac{ds}{dt} = \\frac{x+2x^3}{\\sqrt{x^2+x^4}}\\frac{dx}{dt}","hint":"Divide by 2s and simplify."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-by-parts-application-12dqqzu',
  'integ.by-parts',
  'application',
  'free-response',
  'Evaluate $\int e^x \sin x\,dx$.',
  '{"raw":"(e^x * sin(x) - e^x * cos(x)) / 2 + C","latex":"\\dfrac{e^x(\\sin x - \\cos x)}{2} + C","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Apply by parts twice; let I = ∫eˣ sin x dx","expression":"I = e^x\\sin x - \\int e^x\\cos x\\,dx","hint":"Apply by parts with u = sin x, dv = eˣ dx."},{"stepNumber":2,"description":"Apply by parts again to ∫eˣ cos x dx","expression":"\\int e^x\\cos x\\,dx = e^x\\cos x + \\int e^x\\sin x\\,dx","hint":"Apply by parts again."},{"stepNumber":3,"description":"Substitute back: I = eˣ sin x − eˣ cos x − I","expression":"2I = e^x(\\sin x - \\cos x)","hint":"Recognise I appears on both sides."},{"stepNumber":4,"description":"Solve for I","expression":"I = \\frac{e^x(\\sin x - \\cos x)}{2} + C","hint":"Divide by 2."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-by-parts-application-90b3452',
  'integ.by-parts',
  'application',
  'free-response',
  'Evaluate $\int e^x\sin x\,dx$.',
  '{"raw":"e^x(sin x - cos x)/2 + C","latex":"\\dfrac{e^x(\\sin x-\\cos x)}{2}+C","type":"symbolic"}',
  '[{"stepNumber":1,"description":"First IBP: u=sin x, dv=eˣ dx","expression":"\\int e^x\\sin x\\,dx=e^x\\sin x-\\int e^x\\cos x\\,dx","hint":"Apply IBP once."},{"stepNumber":2,"description":"Second IBP on ∫eˣ cos x dx","expression":"\\int e^x\\cos x\\,dx=e^x\\cos x+\\int e^x\\sin x\\,dx","hint":"Apply IBP again."},{"stepNumber":3,"description":"Solve algebraically","expression":"I=e^x\\sin x-e^x\\cos x-I\\Rightarrow I=\\frac{e^x(\\sin x-\\cos x)}{2}","hint":"Let I=∫eˣ sin x dx."}]',
  '[{"id":"misc-2c38d3","description":"Gets wrong sign when applying IBP the second time"},{"id":"misc-80b0e5","description":"Applies IBP a third time instead of solving algebraically"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-by-parts-conceptual-fe5a445',
  'integ.by-parts',
  'conceptual',
  'explain-concept',
  'State the integration by parts formula and the LIATE mnemonic.',
  '{"raw":"∫u dv = uv − ∫v du. LIATE: choose u as Logarithmic, Inverse trig, Algebraic, Trig, Exponential.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Formula","expression":"\\int u\\,dv=uv-\\int v\\,du","hint":"Follows from product rule."},{"stepNumber":2,"description":"LIATE priority","expression":"L>I>A>T>E","hint":"Pick u from highest priority type."},{"stepNumber":3,"description":"dv is whatever remains","expression":"","hint":"dv must be something you can integrate."}]',
  '[{"id":"misc-5b7f19","description":"Chooses u=eˣ when a polynomial is also present"},{"id":"misc-502cee","description":"Writes ∫u dv = uv + ∫v du with a plus sign"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-by-parts-conceptual-ge4eiy',
  'integ.by-parts',
  'conceptual',
  'explain-concept',
  'State the integration by parts formula.',
  '{"raw":"∫u dv = uv - ∫v du","latex":"\\int u\\,dv = uv - \\int v\\,du","type":"text"}',
  '[{"stepNumber":1,"description":"State the formula","expression":"\\int u\\,dv = uv - \\int v\\,du","hint":"This reverses the product rule."},{"stepNumber":2,"description":"LIATE heuristic for choosing u","expression":"\\text{L-I-A-T-E: Log, Inverse trig, Algebraic, Trig, Exponential}","hint":"Which type of function should be u?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-by-parts-procedural-14af8ea',
  'integ.by-parts',
  'procedural',
  'free-response',
  'Evaluate $\int xe^x\,dx$.',
  '{"raw":"(x-1)e^x+C","latex":"(x-1)e^x+C","type":"symbolic"}',
  '[{"stepNumber":1,"description":"u=x, dv=eˣ dx","expression":"u=x,\\;dv=e^x dx","hint":"LIATE: Algebraic before Exponential."},{"stepNumber":2,"description":"du=dx, v=eˣ","expression":"du=dx,\\;v=e^x","hint":"Integrate dv."},{"stepNumber":3,"description":"Apply formula","expression":"xe^x-\\int e^x dx=(x-1)e^x+C","hint":"∫u dv=uv−∫v du."}]',
  '[{"id":"misc-52e97a","description":"Chooses u=eˣ and dv=x dx"},{"id":"misc-bbe9f2","description":"Writes xe^x+e^x instead of xe^x−e^x"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-by-parts-procedural-78c55b0',
  'integ.by-parts',
  'procedural',
  'free-response',
  'Evaluate $\int x\sin x\,dx$.',
  '{"raw":"-x cos x + sin x + C","latex":"-x\\cos x+\\sin x+C","type":"symbolic"}',
  '[{"stepNumber":1,"description":"u=x, dv=sin x dx","expression":"u=x,\\;dv=\\sin x\\,dx","hint":"LIATE."},{"stepNumber":2,"description":"du=dx, v=−cos x","expression":"du=dx,\\;v=-\\cos x","hint":"∫sin x dx=−cos x."},{"stepNumber":3,"description":"Apply formula","expression":"-x\\cos x+\\int\\cos x\\,dx=-x\\cos x+\\sin x+C","hint":"∫u dv=uv−∫v du."}]',
  '[{"id":"misc-c9be46","description":"Chooses u=sin x and dv=x dx"},{"id":"misc-8ea0e8","description":"Writes −x cos x − sin x instead of −x cos x + sin x"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-by-parts-procedural-7ead778',
  'integ.by-parts',
  'procedural',
  'free-response',
  'Evaluate $\int\ln x\,dx$.',
  '{"raw":"x ln x - x + C","latex":"x\\ln x-x+C","type":"symbolic"}',
  '[{"stepNumber":1,"description":"u=ln x, dv=dx","expression":"u=\\ln x,\\;dv=dx","hint":"LIATE: Logarithmic first."},{"stepNumber":2,"description":"du=1/x dx, v=x","expression":"du=\\frac{1}{x}dx,\\;v=x","hint":"Integrate dv."},{"stepNumber":3,"description":"Apply and simplify","expression":"x\\ln x-\\int 1\\,dx=x\\ln x-x+C","hint":"x·(1/x)=1."}]',
  '[{"id":"misc-3f7091","description":"Thinks ∫ln x dx = 1/x + C (confuses with derivative)"},{"id":"misc-40a2f1","description":"Does not see how to apply IBP to ∫ln x dx alone"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-by-parts-procedural-bia1rg',
  'integ.by-parts',
  'procedural',
  'free-response',
  'Evaluate $\int x e^x\,dx$.',
  '{"raw":"x*e^x - e^x + C","latex":"xe^x - e^x + C","type":"symbolic"}',
  '[{"stepNumber":1,"description":"u = x, dv = eˣ dx; du = dx, v = eˣ","expression":"u=x,\\;dv=e^x\\,dx","hint":"Choose u = x (algebraic) by LIATE."},{"stepNumber":2,"description":"Apply formula: xe^x − ∫eˣ dx","expression":"xe^x - e^x + C","hint":"Apply ∫u dv = uv − ∫v du."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-by-parts-procedural-phjcdz',
  'integ.by-parts',
  'procedural',
  'free-response',
  'Evaluate $\int x \ln x\,dx$.',
  '{"raw":"x^2*ln(x)/2 - x^2/4 + C","latex":"\\dfrac{x^2\\ln x}{2} - \\dfrac{x^2}{4} + C","type":"symbolic"}',
  '[{"stepNumber":1,"description":"u = ln x, dv = x dx; du = dx/x, v = x²/2","expression":"u=\\ln x,\\;dv=x\\,dx","hint":"Choose u = ln x (logarithm) by LIATE."},{"stepNumber":2,"description":"Apply formula","expression":"\\frac{x^2\\ln x}{2} - \\int\\frac{x^2}{2}\\cdot\\frac{1}{x}\\,dx = \\frac{x^2\\ln x}{2} - \\frac{x^2}{4} + C","hint":"Simplify the remaining integral."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-by-parts-proof-sketch-1kgemj4',
  'integ.by-parts',
  'proof-sketch',
  'free-response',
  'Derive the integration by parts formula from the product rule.',
  '{"raw":"Product rule: (uv)'' = u''v + uv''; integrate both sides; rearrange to get ∫u dv = uv - ∫v du","latex":"\\int u\\,dv = uv - \\int v\\,du","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Start from the product rule: (uv)'' = u''v + uv''","expression":"(uv)'' = u''v + uv''","hint":"Write the product rule."},{"stepNumber":2,"description":"Integrate both sides","expression":"uv = \\int u''v\\,dx + \\int uv''\\,dx","hint":"Integrate both sides with respect to x."},{"stepNumber":3,"description":"Rearrange: ∫uv''dx = uv − ∫u''v dx, i.e. ∫u dv = uv − ∫v du","expression":"\\int u\\,dv = uv - \\int v\\,du","hint":"Isolate one integral."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-by-parts-proof-sketch-a211419',
  'integ.by-parts',
  'proof-sketch',
  'free-response',
  'Derive the integration by parts formula from the product rule.',
  '{"raw":"Product rule: d(uv)/dx=u''v+uv''. Integrate: uv=∫u''v dx+∫uv'' dx. Rearrange: ∫uv'' dx=uv−∫u''v dx. In differentials: ∫u dv=uv−∫v du.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Product rule","expression":"\\frac{d}{dx}(uv)=u''v+uv''","hint":"Differentiate a product."},{"stepNumber":2,"description":"Integrate both sides","expression":"uv=\\int u''v\\,dx+\\int uv''\\,dx","hint":"Antiderivative of a derivative."},{"stepNumber":3,"description":"Rearrange","expression":"\\int uv''\\,dx=uv-\\int u''v\\,dx","hint":"Isolate one integral."},{"stepNumber":4,"description":"Differential notation","expression":"\\int u\\,dv=uv-\\int v\\,du","hint":"uv''dx=u dv, u''v dx=v du."}]',
  '[{"id":"misc-b56748","description":"Tries to derive IBP without starting from the product rule"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-definite-apps-application-d67d700',
  'integ.definite-apps',
  'application',
  'free-response',
  'A particle has velocity $v(t)=6t-t^2$ m/s on $[0,6]$. Find the total distance traveled.',
  '{"raw":"36 m","latex":"36\\text{ m}","type":"numeric"}',
  '[{"stepNumber":1,"description":"Find zeros of v(t)","expression":"t(6-t)=0\\Rightarrow t=0,6","hint":"v does not change sign on (0,6)."},{"stepNumber":2,"description":"v(t)≥0 on [0,6]","expression":"\\text{distance}=\\text{displacement}","hint":"Since v≥0, distance=|displacement|."},{"stepNumber":3,"description":"Evaluate","expression":"\\int_0^6(6t-t^2)dt=[3t^2-t^3/3]_0^6=108-72=36","hint":"FTC."}]',
  '[{"id":"misc-c630ec","description":"Does not check sign of v(t) before computing distance"},{"id":"misc-374110","description":"Writes antiderivative of 6t as 3t instead of 3t²"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-definite-apps-application-vvk5d4',
  'integ.definite-apps',
  'application',
  'free-response',
  'Find the area enclosed by $y = x^2 - 4$ and $y = -x^2 + 4$.',
  '{"raw":"64/3","latex":"\\dfrac{64}{3}","type":"numeric"}',
  '[{"stepNumber":1,"description":"Find intersections: x²−4 = −x²+4 → x = ±2","expression":"x = \\pm 2","hint":"Set the two expressions equal and solve."},{"stepNumber":2,"description":"Top curve: −x²+4 ≥ x²−4 on [−2,2]","expression":"(-x^2+4)-(x^2-4) = 8-2x^2","hint":"Which curve is on top between the intersections?"},{"stepNumber":3,"description":"Integrate: ∫₋₂²(8−2x²)dx","expression":"\\left[8x - \\frac{2x^3}{3}\\right]_{-2}^{2} = \\frac{64}{3}","hint":"Evaluate the integral."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-definite-apps-conceptual-17iw0x6',
  'integ.definite-apps',
  'conceptual',
  'explain-concept',
  'How do you find the area between two curves $f(x)$ and $g(x)$ on $[a, b]$ where $f \geq g$?',
  '{"raw":"∫_a^b [f(x) - g(x)] dx","latex":"\\int_a^b [f(x) - g(x)]\\,dx","type":"text"}',
  '[{"stepNumber":1,"description":"Identify the top and bottom curves","expression":"f(x) \\geq g(x) \\text{ on } [a,b]","hint":"Which curve is on top?"},{"stepNumber":2,"description":"Integrate the difference","expression":"\\int_a^b [f(x)-g(x)]\\,dx","hint":"What is the area of a thin vertical strip?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-definite-apps-conceptual-22ac908',
  'integ.definite-apps',
  'conceptual',
  'explain-concept',
  'Explain how to set up a definite integral for the area between two curves.',
  '{"raw":"Area=∫_a^b |f(x)−g(x)| dx. If f≥g on [a,b], this is ∫_a^b [f(x)−g(x)] dx.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Identify which function is on top","expression":"f(x)\\geq g(x) \\text{ on } [a,b]","hint":"Sketch the curves."},{"stepNumber":2,"description":"Set up integral","expression":"A=\\int_a^b[f(x)-g(x)]dx","hint":"Subtract lower from upper."},{"stepNumber":3,"description":"If curves cross, split","expression":"A=\\int_a^c[f-g]dx+\\int_c^b[g-f]dx","hint":"Find where f(x)=g(x)."}]',
  '[{"id":"misc-d07823","description":"Forgets |f−g| when curves cross, getting net signed area"},{"id":"misc-37e654","description":"Subtracts f from g when f is on top"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-definite-apps-procedural-1mt991u',
  'integ.definite-apps',
  'procedural',
  'free-response',
  'Find the average value of $f(x) = x^2$ on $[0, 3]$.',
  '{"raw":"3","latex":"3","type":"numeric"}',
  '[{"stepNumber":1,"description":"Average value formula: (1/(b−a))∫_a^b f(x)dx","expression":"\\frac{1}{3}\\int_0^3 x^2\\,dx","hint":"What is the formula for the average value of a function?"},{"stepNumber":2,"description":"Evaluate: (1/3)[x³/3]₀³ = (1/3)(9) = 3","expression":"\\frac{1}{3}\\cdot 9 = 3","hint":"Compute the integral and multiply by 1/(b−a)."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-definite-apps-procedural-54f0dbf',
  'integ.definite-apps',
  'procedural',
  'free-response',
  'Find the average value of $f(x)=x^2$ on $[0,3]$.',
  '{"raw":"3","latex":"3","type":"numeric"}',
  '[{"stepNumber":1,"description":"Average value formula","expression":"f_{\\text{avg}}=\\frac{1}{3}\\int_0^3 x^2\\,dx","hint":"Average=(1/(b−a))∫f dx."},{"stepNumber":2,"description":"Evaluate integral","expression":"[x^3/3]_0^3=9","hint":"Antiderivative of x² is x³/3."},{"stepNumber":3,"description":"Divide","expression":"9/3=3","hint":"b−a=3."}]',
  '[{"id":"misc-94acfd","description":"Gives 9 without dividing by (b−a)=3"},{"id":"misc-bad1ad","description":"Uses (f(0)+f(3))/2=(0+9)/2=4.5"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-definite-apps-procedural-6p4okv',
  'integ.definite-apps',
  'procedural',
  'free-response',
  'Find the area between $y = x^2$ and $y = x$ on $[0, 1]$.',
  '{"raw":"1/6","latex":"\\dfrac{1}{6}","type":"numeric"}',
  '[{"stepNumber":1,"description":"On [0,1]: x ≥ x² (check at x = 0.5)","expression":"x - x^2 \\geq 0","hint":"Which curve is on top?"},{"stepNumber":2,"description":"Integrate: ∫₀¹(x − x²)dx","expression":"\\left[\\frac{x^2}{2} - \\frac{x^3}{3}\\right]_0^1 = \\frac{1}{2} - \\frac{1}{3} = \\frac{1}{6}","hint":"Evaluate the integral."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-definite-apps-procedural-b60668f',
  'integ.definite-apps',
  'procedural',
  'free-response',
  'Find the area enclosed between $y=x$ and $y=x^2$ on $[0,1]$.',
  '{"raw":"1/6","latex":"\\dfrac{1}{6}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"x≥x² on [0,1]","expression":"x-x^2\\geq 0","hint":"Test x=0.5."},{"stepNumber":2,"description":"Integrate","expression":"\\int_0^1(x-x^2)dx=[x^2/2-x^3/3]_0^1","hint":"Antiderivative."},{"stepNumber":3,"description":"Evaluate","expression":"1/2-1/3=1/6","hint":"F(1)−F(0)."}]',
  '[{"id":"misc-c3659f","description":"Integrates x²−x instead of x−x²"},{"id":"misc-4cb871","description":"Uses wrong limits"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-definite-apps-proof-sketch-1q52ni',
  'integ.definite-apps',
  'proof-sketch',
  'free-response',
  'Prove that the average value of $f$ on $[a,b]$ equals $f(c)$ for some $c \in [a,b]$ (Mean Value Theorem for Integrals).',
  '{"raw":"Let A = (1/(b-a))∫_a^b f; since f is continuous on [a,b], by IVT f attains every value between its min and max, including A","latex":"A = \\frac{1}{b-a}\\int_a^b f \\in [m,M] \\Rightarrow \\exists c: f(c)=A","type":"text"}',
  '[{"stepNumber":1,"description":"Let m = min f, M = max f on [a,b]; then m(b−a) ≤ ∫f ≤ M(b−a)","expression":"m \\leq \\frac{1}{b-a}\\int_a^b f \\leq M","hint":"Bound the integral using the min and max of f."},{"stepNumber":2,"description":"So A = (1/(b−a))∫f lies in [m, M]","expression":"A \\in [m, M]","hint":"What range does A fall in?"},{"stepNumber":3,"description":"By IVT (f continuous), ∃c ∈ [a,b] with f(c) = A","expression":"\\exists c \\in [a,b]: f(c) = A","hint":"Apply the Intermediate Value Theorem."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-definite-apps-proof-sketch-e476704',
  'integ.definite-apps',
  'proof-sketch',
  'free-response',
  'Derive the formula $V=\dfrac{4}{3}\pi r^3$ for the volume of a sphere using the disk method.',
  '{"raw":"V=∫_{-r}^{r}π(r²−x²)dx=π[r²x−x³/3]_{-r}^{r}=π(2r³−2r³/3)=(4/3)πr³.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Cross-sectional radius at x","expression":"y=\\sqrt{r^2-x^2}","hint":"Circle x²+y²=r²."},{"stepNumber":2,"description":"Disk area","expression":"A(x)=\\pi(r^2-x^2)","hint":"Area=πy²."},{"stepNumber":3,"description":"Integrate","expression":"V=\\int_{-r}^r\\pi(r^2-x^2)dx","hint":"FTC."},{"stepNumber":4,"description":"Evaluate","expression":"\\pi[r^2x-x^3/3]_{-r}^r=\\frac{4\\pi r^3}{3}","hint":"Simplify."}]',
  '[{"id":"misc-bfd55b","description":"Uses limits 0 to r and forgets to double"},{"id":"misc-aa4c8f","description":"Uses V=πr²h (cylinder) instead of disk method"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-ftc-application-1lp1ckf',
  'integ.ftc',
  'application',
  'free-response',
  'Evaluate $\int_0^{\pi} \sin x\,dx$.',
  '{"raw":"2","latex":"2","type":"numeric"}',
  '[{"stepNumber":1,"description":"Antiderivative of sin x is −cos x","expression":"F(x) = -\\cos x","hint":"What function has derivative sin x?"},{"stepNumber":2,"description":"Apply FTC Part 2","expression":"-\\cos\\pi - (-\\cos 0) = 1 + 1 = 2","hint":"Evaluate −cos x at π and 0."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-ftc-application-2c0befa',
  'integ.ftc',
  'application',
  'free-response',
  'A particle has velocity $v(t)=t^2-4t+3$ ft/s on $[0,3]$. Find displacement and total distance.',
  '{"raw":"Displacement=0; total distance=8/3 ft","latex":"\\text{Disp}=0,\\;\\text{Dist}=\\dfrac{8}{3}","type":"text"}',
  '[{"stepNumber":1,"description":"Displacement","expression":"\\int_0^3(t^2-4t+3)dt=[t^3/3-2t^2+3t]_0^3=0","hint":"Integrate v(t)."},{"stepNumber":2,"description":"Zeros of v(t)","expression":"(t-1)(t-3)=0\\Rightarrow t=1,3","hint":"Where does particle change direction?"},{"stepNumber":3,"description":"Total distance","expression":"\\int_0^1 v\\,dt+\\int_1^3(-v)\\,dt=4/3+4/3=8/3","hint":"v>0 on (0,1), v<0 on (1,3)."}]',
  '[{"id":"misc-ead01e","description":"Equates displacement with total distance"},{"id":"misc-9cfdd2","description":"Integrates v(t) without checking where v<0"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-ftc-conceptual-13d6cjv',
  'integ.ftc',
  'conceptual',
  'explain-concept',
  'State both parts of the Fundamental Theorem of Calculus.',
  '{"raw":"Part 1: d/dx[∫_a^x f(t)dt] = f(x); Part 2: ∫_a^b f(x)dx = F(b) - F(a)","latex":"\\text{FTC1: }\\frac{d}{dx}\\int_a^x f = f(x);\\;\\text{FTC2: }\\int_a^b f = F(b)-F(a)","type":"text"}',
  '[{"stepNumber":1,"description":"FTC Part 1: differentiation undoes integration","expression":"\\frac{d}{dx}\\int_a^x f(t)\\,dt = f(x)","hint":"What is the derivative of an integral with variable upper limit?"},{"stepNumber":2,"description":"FTC Part 2: use antiderivative to evaluate definite integral","expression":"\\int_a^b f(x)\\,dx = F(b) - F(a)","hint":"How do you evaluate a definite integral using an antiderivative?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-ftc-conceptual-2d533d2',
  'integ.ftc',
  'conceptual',
  'explain-concept',
  'State both parts of the Fundamental Theorem of Calculus.',
  '{"raw":"Part 1: If F(x)=∫_a^x f(t)dt then F''(x)=f(x). Part 2: ∫_a^b f(x)dx=F(b)−F(a).","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"FTC Part 1","expression":"F(x)=\\int_a^x f(t)dt\\Rightarrow F''(x)=f(x)","hint":"Differentiation undoes integration."},{"stepNumber":2,"description":"FTC Part 2","expression":"\\int_a^b f(x)dx=F(b)-F(a)","hint":"Find any antiderivative F."},{"stepNumber":3,"description":"Connection","expression":"","hint":"The two parts show differentiation and integration are inverse operations."}]',
  '[{"id":"misc-7a8de0","description":"Confuses which part is which"},{"id":"misc-d5c2b0","description":"Thinks a specific antiderivative (with +C=0) must be used in Part 2"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-ftc-procedural-1y4cduc',
  'integ.ftc',
  'procedural',
  'free-response',
  'Evaluate $\int_1^4 (2x + 3)\,dx$.',
  '{"raw":"21","latex":"21","type":"numeric"}',
  '[{"stepNumber":1,"description":"Antiderivative: F(x) = x² + 3x","expression":"F(x) = x^2 + 3x","hint":"Find an antiderivative of 2x + 3."},{"stepNumber":2,"description":"Apply FTC Part 2","expression":"F(4) - F(1) = (16+12) - (1+3) = 28 - 4 = 24","hint":"Evaluate F(4) − F(1)."}]',
  '[{"id":"mc-ftc-1","description":"Forgets to subtract F(a)","incorrectPattern":"F(4) only","remediationConceptId":"integ.ftc"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-ftc-procedural-402b034',
  'integ.ftc',
  'procedural',
  'free-response',
  'Evaluate $\int_1^3(4x^3-2x)\,dx$.',
  '{"raw":"72","latex":"72","type":"numeric"}',
  '[{"stepNumber":1,"description":"Antiderivative","expression":"F(x)=x^4-x^2","hint":"Integrate term by term."},{"stepNumber":2,"description":"Evaluate","expression":"F(3)-F(1)=(81-9)-(1-1)=72","hint":"FTC Part 2."}]',
  '[{"id":"misc-18c102","description":"Computes F(1)−F(3) instead of F(3)−F(1)"},{"id":"misc-3ec385","description":"Writes x⁴ for ∫4x³ dx but forgets −x²"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-ftc-procedural-afef8b4',
  'integ.ftc',
  'procedural',
  'free-response',
  'Find $G''(x)$ where $G(x)=\int_1^{x^3}\sqrt{t}\,dt$.',
  '{"raw":"G''(x)=3x^{7/2}","latex":"G''(x)=3x^{7/2}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"FTC Part 1 with chain rule","expression":"G''(x)=\\sqrt{x^3}\\cdot 3x^2","hint":"Derivative of upper limit times integrand there."},{"stepNumber":2,"description":"Simplify","expression":"\\sqrt{x^3}=x^{3/2},\\;G''(x)=3x^2\\cdot x^{3/2}=3x^{7/2}","hint":"Add exponents: 2+3/2=7/2."}]',
  '[{"id":"misc-78b2ba","description":"Writes √(x³) without the 3x² factor"},{"id":"misc-65cdb1","description":"Evaluates the integral and then differentiates"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-ftc-procedural-sbckme',
  'integ.ftc',
  'procedural',
  'free-response',
  'Find $\dfrac{d}{dx}\int_0^{x^2} \sin t\,dt$.',
  '{"raw":"2x * sin(x^2)","latex":"2x\\sin(x^2)","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Upper limit is x², not x — use chain rule with FTC Part 1","expression":"\\sin(x^2) \\cdot \\frac{d}{dx}[x^2]","hint":"The upper limit is a function of x — what rule applies?"},{"stepNumber":2,"description":"Result","expression":"2x\\sin(x^2)","hint":"Multiply by the derivative of the upper limit."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-ftc-proof-sketch-f2fb331',
  'integ.ftc',
  'proof-sketch',
  'free-response',
  'Prove FTC Part 2: $\int_a^b f(x)\,dx=F(b)-F(a)$ using FTC Part 1.',
  '{"raw":"Let G(x)=∫_a^x f(t)dt. By FTC1, G''(x)=f(x). So G(x)=F(x)+C. G(a)=0 gives C=−F(a). Then G(b)=F(b)−F(a).","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Define G(x)","expression":"G(a)=0,\\;G''(x)=f(x)","hint":"G is an antiderivative of f."},{"stepNumber":2,"description":"F and G differ by constant","expression":"G(x)=F(x)+C","hint":"Two functions with same derivative differ by constant."},{"stepNumber":3,"description":"Find C","expression":"G(a)=F(a)+C=0\\Rightarrow C=-F(a)","hint":"Substitute x=a."},{"stepNumber":4,"description":"Evaluate G(b)","expression":"G(b)=F(b)-F(a)","hint":"Substitute x=b."}]',
  '[{"id":"misc-b73f32","description":"Tries to prove FTC2 from Riemann sums without using FTC1"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-ftc-proof-sketch-ipduei',
  'integ.ftc',
  'proof-sketch',
  'free-response',
  'Prove FTC Part 1: if $F(x) = \int_a^x f(t)\,dt$ and $f$ is continuous, then $F''(x) = f(x)$.',
  '{"raw":"F''(x) = lim_{h→0} [F(x+h)-F(x)]/h = lim_{h→0} (1/h)∫_x^{x+h} f(t)dt = f(x) by MVT for integrals","latex":"F''(x) = \\lim_{h\\to 0}\\frac{1}{h}\\int_x^{x+h}f(t)\\,dt = f(x)","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Write the difference quotient for F","expression":"\\frac{F(x+h)-F(x)}{h} = \\frac{1}{h}\\int_x^{x+h}f(t)\\,dt","hint":"Use the definition of F."},{"stepNumber":2,"description":"By MVT for integrals: ∫_x^{x+h} f = f(c)·h for some c ∈ (x, x+h)","expression":"\\frac{1}{h}\\cdot f(c)\\cdot h = f(c)","hint":"Apply the Mean Value Theorem for integrals."},{"stepNumber":3,"description":"As h → 0: c → x, so f(c) → f(x) by continuity","expression":"f(c) \\to f(x)","hint":"Use continuity of f."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-riemann-application-21cdb3e',
  'integ.riemann',
  'application',
  'free-response',
  'Express $\int_0^2(2x+1)\,dx$ as a limit of right Riemann sums and evaluate.',
  '{"raw":"6","latex":"6","type":"numeric"}',
  '[{"stepNumber":1,"description":"Set up limit","expression":"\\lim_{n\\to\\infty}\\sum_{i=1}^n f(2i/n)\\cdot(2/n)","hint":"Δx=2/n, right endpoint=2i/n."},{"stepNumber":2,"description":"Or use FTC","expression":"\\int_0^2(2x+1)dx=[x^2+x]_0^2=6","hint":"Antiderivative of 2x+1 is x²+x."}]',
  '[{"id":"misc-1d83d4","description":"Uses Δx=2 instead of 2/n"},{"id":"misc-e4fac4","description":"Evaluates for finite n without taking the limit"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-riemann-application-ns905n',
  'integ.riemann',
  'application',
  'free-response',
  'Explain why $\int_0^1 x^2\,dx = 1/3$ using the limit of right Riemann sums and the formula $\sum_{i=1}^n i^2 = \frac{n(n+1)(2n+1)}{6}$.',
  '{"raw":"1/3","latex":"\\dfrac{1}{3}","type":"numeric"}',
  '[{"stepNumber":1,"description":"Right sum: Σ(i/n)²·(1/n) = (1/n³)Σi²","expression":"\\frac{1}{n^3}\\cdot\\frac{n(n+1)(2n+1)}{6}","hint":"Write the Riemann sum and factor out 1/n³."},{"stepNumber":2,"description":"Simplify and take limit","expression":"\\lim_{n\\to\\infty}\\frac{(n+1)(2n+1)}{6n^2} = \\frac{2}{6} = \\frac{1}{3}","hint":"Divide numerator and denominator by n² and take n → ∞."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-riemann-conceptual-1fi6jv5',
  'integ.riemann',
  'conceptual',
  'explain-concept',
  'What does a Riemann sum approximate?',
  '{"raw":"The area under a curve (the definite integral)","latex":"\\int_a^b f(x)\\,dx \\approx \\sum_{i=1}^n f(x_i^*)\\Delta x","type":"text"}',
  '[{"stepNumber":1,"description":"A Riemann sum partitions [a,b] into n subintervals","expression":"\\Delta x = \\frac{b-a}{n}","hint":"How is the interval divided?"},{"stepNumber":2,"description":"Sum of rectangle areas approximates the integral","expression":"\\sum_{i=1}^n f(x_i^*)\\Delta x","hint":"What does each term represent geometrically?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-riemann-conceptual-c5c131e',
  'integ.riemann',
  'conceptual',
  'explain-concept',
  'Explain the difference between left, right, and midpoint Riemann sums and when each overestimates or underestimates.',
  '{"raw":"Left uses left endpoints; overestimates if f decreasing. Right uses right endpoints; opposite. Midpoint uses midpoints; generally most accurate.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Left Riemann sum","expression":"L_n=\\sum_{i=0}^{n-1}f(x_i)\\Delta x","hint":"Which endpoint?"},{"stepNumber":2,"description":"Right Riemann sum","expression":"R_n=\\sum_{i=1}^{n}f(x_i)\\Delta x","hint":"Right endpoint of each subinterval."},{"stepNumber":3,"description":"Over/underestimate","expression":"f\\text{ increasing}: L_n<\\int<R_n","hint":"Draw a picture."}]',
  '[{"id":"misc-d80970","description":"Thinks a Riemann sum gives the exact integral value"},{"id":"misc-4b6c50","description":"Thinks more rectangles gives the exact integral"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-riemann-procedural-0a3dda0',
  'integ.riemann',
  'procedural',
  'free-response',
  'Use the trapezoidal rule with $n=4$ to approximate $\int_0^2 e^x\,dx$.',
  '{"raw":"≈6.509","latex":"\\approx 6.509","type":"numeric"}',
  '[{"stepNumber":1,"description":"Δx=0.5; nodes: 0, 0.5, 1, 1.5, 2","expression":"x_0=0,\\ldots,x_4=2","hint":"Divide [0,2] into 4 equal parts."},{"stepNumber":2,"description":"Trapezoidal formula","expression":"T_4=\\frac{\\Delta x}{2}[f(x_0)+2f(x_1)+2f(x_2)+2f(x_3)+f(x_4)]","hint":"Weight interior nodes by 2."},{"stepNumber":3,"description":"Evaluate","expression":"\\frac{0.5}{2}[1+2e^{0.5}+2e+2e^{1.5}+e^2]\\approx 6.509","hint":"Use e≈2.718."}]',
  '[{"id":"misc-8010d5","description":"Uses weight 2 for all nodes including endpoints"},{"id":"misc-cc08a4","description":"Forgets the Δx/2 factor in the trapezoidal rule"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-riemann-procedural-1dunopc',
  'integ.riemann',
  'procedural',
  'free-response',
  'Write the definite integral $\int_1^3 x^2\,dx$ as a limit of right Riemann sums.',
  '{"raw":"lim_{n→∞} Σ (1 + i*2/n)^2 * (2/n)","latex":"\\lim_{n\\to\\infty}\\sum_{i=1}^n\\left(1+\\frac{2i}{n}\\right)^2\\cdot\\frac{2}{n}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Δx = (3−1)/n = 2/n; right endpoint: xᵢ = 1 + i·(2/n)","expression":"x_i = 1 + \\frac{2i}{n}","hint":"What is the i-th right endpoint?"},{"stepNumber":2,"description":"Write the limit of the sum","expression":"\\lim_{n\\to\\infty}\\sum_{i=1}^n f(x_i)\\Delta x","hint":"Substitute into the Riemann sum formula."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-riemann-procedural-a5c0666',
  'integ.riemann',
  'procedural',
  'free-response',
  'Approximate $\int_0^3 x^2\,dx$ using a right Riemann sum with $n=3$ equal subintervals.',
  '{"raw":"14","latex":"14","type":"numeric"}',
  '[{"stepNumber":1,"description":"Δx=1; right endpoints: x=1,2,3","expression":"\\Delta x=1","hint":"(3−0)/3=1."},{"stepNumber":2,"description":"Evaluate f at right endpoints","expression":"1+4+9=14","hint":"f(x)=x²."},{"stepNumber":3,"description":"Multiply by Δx=1","expression":"R_3=14","hint":"Each rectangle has width 1."}]',
  '[{"id":"misc-fbf4a5","description":"Includes x=0 as a right endpoint"},{"id":"misc-028593","description":"Uses Δx=3 instead of 1"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-riemann-procedural-ufmqw4',
  'integ.riemann',
  'procedural',
  'free-response',
  'Compute the left Riemann sum for $f(x) = x^2$ on $[0, 2]$ with $n = 4$ subintervals.',
  '{"raw":"7/4","latex":"\\dfrac{7}{4}","type":"numeric"}',
  '[{"stepNumber":1,"description":"Δx = 2/4 = 0.5; left endpoints: 0, 0.5, 1, 1.5","expression":"\\Delta x = 0.5","hint":"What is the width of each subinterval?"},{"stepNumber":2,"description":"Sum: f(0)·0.5 + f(0.5)·0.5 + f(1)·0.5 + f(1.5)·0.5","expression":"0 + 0.125 + 0.5 + 1.125 = 1.75","hint":"Evaluate f at each left endpoint and multiply by Δx."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-riemann-proof-sketch-1nd3uwy',
  'integ.riemann',
  'proof-sketch',
  'free-response',
  'Prove that $\int_0^1 x\,dx = \dfrac{1}{2}$ using the limit of right Riemann sums and the formula $\sum_{i=1}^n i = \dfrac{n(n+1)}{2}$.',
  '{"raw":"1/2","latex":"\\dfrac{1}{2}","type":"numeric"}',
  '[{"stepNumber":1,"description":"Right sum: Σ(i/n)·(1/n) = (1/n²)Σi","expression":"\\frac{1}{n^2}\\cdot\\frac{n(n+1)}{2}","hint":"Write the Riemann sum and factor."},{"stepNumber":2,"description":"Simplify: (n+1)/(2n)","expression":"\\frac{n+1}{2n}","hint":"Simplify the expression."},{"stepNumber":3,"description":"Take limit: (n+1)/(2n) → 1/2","expression":"\\lim_{n\\to\\infty}\\frac{n+1}{2n} = \\frac{1}{2}","hint":"Divide numerator and denominator by n."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-riemann-proof-sketch-b10af42',
  'integ.riemann',
  'proof-sketch',
  'free-response',
  'Show that $\int_a^b c\,dx=c(b-a)$ using the Riemann sum definition.',
  '{"raw":"Each Riemann sum = c·Δx·n = c(b−a). Taking the limit gives c(b−a).","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Write Riemann sum","expression":"\\sum_{i=1}^n c\\cdot\\frac{b-a}{n}","hint":"f(x)=c is constant."},{"stepNumber":2,"description":"Simplify","expression":"c\\cdot\\frac{b-a}{n}\\cdot n=c(b-a)","hint":"Sum of n identical terms."},{"stepNumber":3,"description":"Take limit","expression":"\\lim_{n\\to\\infty}c(b-a)=c(b-a)","hint":"Sum is independent of n."}]',
  '[{"id":"misc-2718f5","description":"Writes ∫c dx = c without the (b−a) factor"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-substitution-application-1plhag5',
  'integ.substitution',
  'application',
  'free-response',
  'Evaluate $\int \dfrac{\ln x}{x}\,dx$.',
  '{"raw":"(ln x)^2 / 2 + C","latex":"\\dfrac{(\\ln x)^2}{2} + C","type":"symbolic"}',
  '[{"stepNumber":1,"description":"u = ln x, du = dx/x","expression":"u = \\ln x,\\; du = \\frac{dx}{x}","hint":"What substitution turns ln x / x into u?"},{"stepNumber":2,"description":"∫u du = u²/2","expression":"\\frac{u^2}{2} + C","hint":"Integrate u."},{"stepNumber":3,"description":"Back-substitute","expression":"\\frac{(\\ln x)^2}{2} + C","hint":"Replace u."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-substitution-application-4ef3d07',
  'integ.substitution',
  'application',
  'free-response',
  'Evaluate $\int\dfrac{\ln x}{x}\,dx$.',
  '{"raw":"(ln x)^2/2+C","latex":"\\dfrac{(\\ln x)^2}{2}+C","type":"symbolic"}',
  '[{"stepNumber":1,"description":"u=ln x, du=dx/x","expression":"u=\\ln x,\\;du=\\frac{1}{x}dx","hint":"What simplifies ln x / x?"},{"stepNumber":2,"description":"Rewrite","expression":"\\int u\\,du","hint":"ln x · (1/x dx) = u du."},{"stepNumber":3,"description":"Integrate","expression":"u^2/2+C=(\\ln x)^2/2+C","hint":"Power rule."}]',
  '[{"id":"misc-9c5214","description":"Confuses derivative and integral of ln x"},{"id":"misc-dca045","description":"Uses du=1/x without recognizing 1/x is already in integrand"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-substitution-conceptual-354c561',
  'integ.substitution',
  'conceptual',
  'explain-concept',
  'Explain how $u$-substitution is the integration analogue of the chain rule.',
  '{"raw":"Chain rule: d/dx[F(g(x))]=F''(g(x))g''(x). Reversing: ∫F''(g(x))g''(x)dx=F(g(x))+C. Setting u=g(x), du=g''(x)dx gives ∫F''(u)du=F(u)+C.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Chain rule","expression":"\\frac{d}{dx}[F(g(x))]=F''(g(x))g''(x)","hint":"What does the chain rule say?"},{"stepNumber":2,"description":"Reverse","expression":"\\int F''(g(x))g''(x)dx=F(g(x))+C","hint":"Antiderivative of a derivative."},{"stepNumber":3,"description":"Substitute","expression":"u=g(x),\\;du=g''(x)dx\\Rightarrow\\int F''(u)du=F(u)+C","hint":"The substitution simplifies."}]',
  '[{"id":"misc-84e4bd","description":"Tries u-substitution on integrals with no composite structure"},{"id":"misc-f3e04e","description":"Substitutes u but forgets to replace dx"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-substitution-conceptual-mce6zg',
  'integ.substitution',
  'conceptual',
  'explain-concept',
  'What is the key idea behind u-substitution?',
  '{"raw":"Reverse the chain rule by substituting u = g(x) to simplify the integrand","latex":"u = g(x),\\; du = g''(x)\\,dx \\text{ — reverses chain rule}","type":"text"}',
  '[{"stepNumber":1,"description":"Identify an inner function u = g(x)","expression":"u = g(x)","hint":"Look for a function whose derivative also appears in the integrand."},{"stepNumber":2,"description":"Replace g''(x)dx with du","expression":"du = g''(x)\\,dx","hint":"How does the differential transform?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-substitution-procedural-1lvepuu',
  'integ.substitution',
  'procedural',
  'free-response',
  'Evaluate $\int 2x(x^2+1)^4\,dx$.',
  '{"raw":"(x^2+1)^5 / 5 + C","latex":"\\dfrac{(x^2+1)^5}{5} + C","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Let u = x²+1, du = 2x dx","expression":"u = x^2+1,\\; du = 2x\\,dx","hint":"What substitution simplifies the integrand?"},{"stepNumber":2,"description":"Integral becomes ∫u⁴ du","expression":"\\int u^4\\,du = \\frac{u^5}{5}","hint":"Rewrite in terms of u."},{"stepNumber":3,"description":"Back-substitute","expression":"\\frac{(x^2+1)^5}{5} + C","hint":"Replace u with x²+1."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-substitution-procedural-3a390b1',
  'integ.substitution',
  'procedural',
  'free-response',
  'Evaluate $\int_0^1 xe^{x^2}\,dx$.',
  '{"raw":"(e-1)/2","latex":"\\dfrac{e-1}{2}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"u=x², du=2x dx","expression":"u=x^2,\\;du=2x\\,dx","hint":"Derivative of x² is 2x."},{"stepNumber":2,"description":"Change limits","expression":"x=0\\to u=0,\\;x=1\\to u=1","hint":"Change limits when substituting in definite integral."},{"stepNumber":3,"description":"Evaluate","expression":"\\frac{1}{2}[e^u]_0^1=\\frac{e-1}{2}","hint":"∫eᵘ du = eᵘ."}]',
  '[{"id":"misc-6a27cc","description":"Forgets to change the limits of integration"},{"id":"misc-425fe5","description":"Back-substitutes u=x² and re-evaluates at x=0,1"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-substitution-procedural-5409650',
  'integ.substitution',
  'procedural',
  'free-response',
  'Evaluate $\int 2x(x^2+1)^4\,dx$.',
  '{"raw":"(x^2+1)^5/5+C","latex":"\\dfrac{(x^2+1)^5}{5}+C","type":"symbolic"}',
  '[{"stepNumber":1,"description":"u=x²+1, du=2x dx","expression":"u=x^2+1,\\;du=2x\\,dx","hint":"Inner function."},{"stepNumber":2,"description":"Rewrite","expression":"\\int u^4\\,du","hint":"2x dx = du."},{"stepNumber":3,"description":"Integrate and back-substitute","expression":"u^5/5+C=(x^2+1)^5/5+C","hint":"Power rule."}]',
  '[{"id":"misc-4902cf","description":"Forgets to back-substitute and leaves answer in terms of u"},{"id":"misc-45fbfb","description":"Writes u⁵ instead of u⁵/5"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-substitution-procedural-a43169f',
  'integ.substitution',
  'procedural',
  'free-response',
  'Evaluate $\int\cos(3x)\,dx$.',
  '{"raw":"sin(3x)/3+C","latex":"\\dfrac{\\sin(3x)}{3}+C","type":"symbolic"}',
  '[{"stepNumber":1,"description":"u=3x, du=3 dx","expression":"u=3x,\\;dx=du/3","hint":"Inner function is 3x."},{"stepNumber":2,"description":"Rewrite","expression":"\\frac{1}{3}\\int\\cos u\\,du","hint":"Replace cos(3x)dx with cos(u)·du/3."},{"stepNumber":3,"description":"Integrate","expression":"\\sin(3x)/3+C","hint":"∫cos u du = sin u + C."}]',
  '[{"id":"misc-f9eee4","description":"Writes sin(3x)+C without the 1/3 factor"},{"id":"misc-ea137e","description":"Differentiates instead of integrating: writes −sin(3x)·3"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-substitution-procedural-bvvwuo',
  'integ.substitution',
  'procedural',
  'free-response',
  'Evaluate $\int_0^1 x e^{x^2}\,dx$.',
  '{"raw":"(e-1)/2","latex":"\\dfrac{e-1}{2}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"u = x², du = 2x dx; change limits: u(0)=0, u(1)=1","expression":"u(0)=0,\\; u(1)=1","hint":"Change the limits of integration when substituting."},{"stepNumber":2,"description":"Integral: (1/2)∫₀¹ eᵘ du","expression":"\\frac{1}{2}[e^u]_0^1","hint":"Factor out 1/2 and integrate eᵘ."},{"stepNumber":3,"description":"Evaluate","expression":"\\frac{1}{2}(e-1)","hint":"Apply FTC Part 2."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-substitution-proof-sketch-1x0wkof',
  'integ.substitution',
  'proof-sketch',
  'free-response',
  'Prove the substitution rule: if $u = g(x)$ is differentiable and $f$ is continuous, then $\int f(g(x))g''(x)\,dx = \int f(u)\,du$.',
  '{"raw":"Let F be an antiderivative of f; by the chain rule d/dx[F(g(x))] = f(g(x))g''(x); integrating both sides gives the result","latex":"\\frac{d}{dx}[F(g(x))] = f(g(x))g''(x) \\Rightarrow \\int f(g(x))g''(x)\\,dx = F(g(x))+C","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Let F be an antiderivative of f: F''= f","expression":"F''(u) = f(u)","hint":"What is an antiderivative of f?"},{"stepNumber":2,"description":"Chain rule: d/dx[F(g(x))] = F''(g(x))g''(x) = f(g(x))g''(x)","expression":"\\frac{d}{dx}[F(g(x))] = f(g(x))g''(x)","hint":"Apply the chain rule to F(g(x))."},{"stepNumber":3,"description":"Integrate both sides","expression":"\\int f(g(x))g''(x)\\,dx = F(g(x))+C = \\int f(u)\\,du","hint":"Integrate and recognise F(g(x)) = ∫f(u)du."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'integ-substitution-proof-sketch-b866f13',
  'integ.substitution',
  'proof-sketch',
  'free-response',
  'Prove the substitution rule: $\int_a^b f(g(x))g''(x)\,dx=\int_{g(a)}^{g(b)}f(u)\,du$.',
  '{"raw":"Let F be antiderivative of f. By chain rule, d/dx[F(g(x))]=f(g(x))g''(x). By FTC2, both sides equal F(g(b))−F(g(a)).","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Let F be antiderivative of f","expression":"F''(u)=f(u)","hint":"F exists by FTC."},{"stepNumber":2,"description":"Chain rule","expression":"\\frac{d}{dx}[F(g(x))]=f(g(x))g''(x)","hint":"Chain rule."},{"stepNumber":3,"description":"FTC2 on left side","expression":"\\int_a^b f(g(x))g''(x)dx=F(g(b))-F(g(a))","hint":"FTC2."},{"stepNumber":4,"description":"Recognize right side","expression":"F(g(b))-F(g(a))=\\int_{g(a)}^{g(b)}f(u)du","hint":"FTC2 applied to f."}]',
  '[{"id":"misc-b74bb1","description":"States the proof informally as ''du cancels'' without rigorous steps"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'lim-definition-application-gt272v',
  'limits.definition',
  'application',
  'free-response',
  'Find $\lim_{x \to 0} \dfrac{\sin x}{x}$. (You may use the known result.)',
  '{"raw":"1","latex":"1","type":"numeric"}',
  '[{"stepNumber":1,"description":"Recognise the standard limit","expression":"\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1","hint":"This is a fundamental trigonometric limit — do you recall its value?"}]',
  '[{"id":"mc-lim-def-3","description":"Substitutes x = 0 to get 0/0","incorrectPattern":"sin(0)/0 = 0/0","remediationConceptId":"limits.definition"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-definition-application-7cb6f91',
  'limits.definition',
  'application',
  'free-response',
  'Find $\lim_{x \to 0} \dfrac{\tan x}{x}$.',
  '{"raw":"1","latex":"1","type":"numeric"}',
  '[{"stepNumber":1,"description":"Rewrite tan x","expression":"\\frac{\\tan x}{x}=\\frac{\\sin x}{x}\\cdot\\frac{1}{\\cos x}","hint":"tan x = sin x / cos x."},{"stepNumber":2,"description":"Apply known limit","expression":"\\lim_{x\\to 0}\\frac{\\sin x}{x}=1","hint":"Standard special limit."},{"stepNumber":3,"description":"Evaluate remaining factor","expression":"\\frac{1}{\\cos 0}=1","hint":"cos(0)=1."}]',
  '[{"id":"misc-63927c","description":"Substitutes x=0 to get 0/0 and concludes DNE"},{"id":"misc-2d81a3","description":"Confuses tan limit with vertical asymptote behavior"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-definition-application-f410a23',
  'limits.definition',
  'application',
  'free-response',
  'Use the Squeeze Theorem to find $\lim_{x \to 0} x^2 \cos\left(\dfrac{1}{x}\right)$.',
  '{"raw":"0","latex":"0","type":"numeric"}',
  '[{"stepNumber":1,"description":"Bound cos(1/x)","expression":"-1 \\leq \\cos(1/x) \\leq 1","hint":"Range of cosine is [−1,1]."},{"stepNumber":2,"description":"Multiply by x²≥0","expression":"-x^2 \\leq x^2\\cos(1/x) \\leq x^2","hint":"x²≥0 preserves inequality."},{"stepNumber":3,"description":"Both bounds → 0","expression":"\\lim_{x\\to 0}x^2=0","hint":"Apply Squeeze Theorem."}]',
  '[{"id":"misc-12db7a","description":"Concludes DNE because cos(1/x) oscillates"},{"id":"misc-bfe73a","description":"Tries to split as lim x² · lim cos(1/x)"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'lim-definition-conceptual-32h8qb',
  'limits.definition',
  'conceptual',
  'explain-concept',
  'In your own words, what does $\lim_{x \to 3} f(x) = 7$ mean?',
  '{"raw":"As x approaches 3, f(x) approaches 7","latex":"\\text{As } x \\to 3,\\; f(x) \\to 7","type":"text"}',
  '[{"stepNumber":1,"description":"Recall the informal definition of a limit","expression":"\\lim_{x \\to a} f(x) = L","hint":"What does it mean for f(x) to get arbitrarily close to a number?"},{"stepNumber":2,"description":"Apply to the specific values a = 3, L = 7","expression":"x \\to 3 \\Rightarrow f(x) \\to 7","hint":"What are the specific values of a and L here?"}]',
  '[{"id":"mc-lim-def-1","description":"Confuses limit with function value","incorrectPattern":"f(3) = 7","remediationConceptId":"limits.definition"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'lim-definition-conceptual-32h8qb-variant-template-generated-fallback',
  'limits.definition',
  'conceptual',
  'free-response',
  'In your own words, what does $\lim_{x \to 3} f(x) = 7$ mean?',
  '{"raw":"As x approaches 3, f(x) approaches 7","latex":"As x approaches 3, f(x) approaches 7","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Use the same method as the source template.","expression":"As x approaches 3, f(x) approaches 7","hint":"Which rule or definition does this template practice?"}]',
  '[]',
  1
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-definition-conceptual-9b85aab',
  'limits.definition',
  'conceptual',
  'explain-concept',
  'Explain why $\lim_{x \to c} f(x)$ does not depend on $f(c)$.',
  '{"raw":"A limit describes what f approaches as x gets close to c, never equaling c.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Limit definition excludes x=c","expression":"0 < |x-c| < \\delta","hint":"The strict inequality 0<|x−c| excludes x=c."},{"stepNumber":2,"description":"f(c) is irrelevant","expression":"","hint":"Could f(c) be undefined and the limit still exist?"}]',
  '[{"id":"misc-aaa38d","description":"Believes lim f(x) as x→c always equals f(c)"},{"id":"misc-2cd891","description":"Thinks if f(c) is undefined the limit cannot exist"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'lim-definition-procedural-7ppnj',
  'limits.definition',
  'procedural',
  'free-response',
  'Evaluate $\lim_{x \to 1} \dfrac{x^2 - 1}{x - 1}$.',
  '{"raw":"2","latex":"2","type":"numeric"}',
  '[{"stepNumber":1,"description":"Direct substitution gives 0/0 — factor the numerator","expression":"x^2 - 1 = (x-1)(x+1)","hint":"What is the factored form of x² − 1?"},{"stepNumber":2,"description":"Cancel the common factor (x ≠ 1)","expression":"\\frac{(x-1)(x+1)}{x-1} = x+1","hint":"What cancels?"},{"stepNumber":3,"description":"Substitute x = 1","expression":"1 + 1 = 2","hint":"Now substitute x = 1."}]',
  '[{"id":"mc-lim-def-2","description":"Divides by zero without factoring","incorrectPattern":"0/0","remediationConceptId":"limits.definition"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'lim-definition-procedural-ke4f7z',
  'limits.definition',
  'procedural',
  'free-response',
  'Evaluate $\lim_{x \to 2} (3x^2 - x + 1)$.',
  '{"raw":"11","latex":"11","type":"numeric"}',
  '[{"stepNumber":1,"description":"Check if direct substitution applies (polynomial — always continuous)","expression":"3(2)^2 - 2 + 1","hint":"Can you substitute x = 2 directly into a polynomial?"},{"stepNumber":2,"description":"Compute","expression":"12 - 2 + 1 = 11","hint":"What is 3 × 4?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-definition-procedural-40066b6',
  'limits.definition',
  'procedural',
  'free-response',
  'Evaluate $\lim_{x \to 4} \dfrac{x^2-16}{x-4}$.',
  '{"raw":"8","latex":"8","type":"numeric"}',
  '[{"stepNumber":1,"description":"Check: 0/0 form","expression":"\\frac{16-16}{4-4}=\\frac{0}{0}","hint":"Factor the numerator."},{"stepNumber":2,"description":"Factor","expression":"x^2-16=(x-4)(x+4)","hint":"Difference of squares."},{"stepNumber":3,"description":"Cancel and evaluate","expression":"\\lim_{x\\to 4}(x+4)=8","hint":"Cancel (x−4) for x≠4."}]',
  '[{"id":"misc-e7571c","description":"Concludes 0/0 means the limit does not exist"},{"id":"misc-336a0b","description":"Cancels x terms without factoring properly"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-definition-procedural-586ca27',
  'limits.definition',
  'procedural',
  'free-response',
  'Evaluate $\lim_{x \to -2} \dfrac{x^2+5x+6}{x+2}$.',
  '{"raw":"1","latex":"1","type":"numeric"}',
  '[{"stepNumber":1,"description":"Check: 0/0 form","expression":"\\frac{4-10+6}{0}=\\frac{0}{0}","hint":"Factor the numerator."},{"stepNumber":2,"description":"Factor","expression":"x^2+5x+6=(x+2)(x+3)","hint":"Two numbers multiply to 6, add to 5."},{"stepNumber":3,"description":"Cancel and evaluate","expression":"\\lim_{x\\to-2}(x+3)=1","hint":"Cancel (x+2)."}]',
  '[{"id":"misc-0f2231","description":"Factors as (x+2)(x+2) instead of (x+2)(x+3)"},{"id":"misc-a81d5a","description":"Concludes limit is 0 because a factor is 0"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-definition-procedural-df02992',
  'limits.definition',
  'procedural',
  'free-response',
  'Evaluate $\lim_{x \to 0} \dfrac{\sqrt{x+4}-2}{x}$.',
  '{"raw":"1/4","latex":"\\dfrac{1}{4}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Direct substitution gives 0/0","expression":"\\frac{0}{0}","hint":"Multiply by conjugate."},{"stepNumber":2,"description":"Multiply by conjugate","expression":"\\frac{(\\sqrt{x+4}-2)(\\sqrt{x+4}+2)}{x(\\sqrt{x+4}+2)}=\\frac{x}{x(\\sqrt{x+4}+2)}","hint":"(a-b)(a+b)=a²-b²."},{"stepNumber":3,"description":"Cancel x and substitute","expression":"\\frac{1}{\\sqrt{4}+2}=\\frac{1}{4}","hint":"Now x=0 is safe."}]',
  '[{"id":"misc-33908b","description":"Rationalizes but forgets to multiply denominator too"},{"id":"misc-036bc5","description":"Thinks the limit is 0 because numerator has √x"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'lim-definition-proof-sketch-13ta28a',
  'limits.definition',
  'proof-sketch',
  'free-response',
  'Using the ε-δ definition, prove that $\lim_{x \to 2}(3x - 1) = 5$.',
  '{"raw":"Given ε > 0, choose δ = ε/3; then |x-2| < δ implies |(3x-1)-5| = 3|x-2| < ε","latex":"\\delta = \\varepsilon/3 \\Rightarrow |(3x-1)-5| < \\varepsilon","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Write |f(x) − L| in terms of |x − a|","expression":"|(3x-1)-5| = |3x-6| = 3|x-2|","hint":"Simplify |(3x−1) − 5|."},{"stepNumber":2,"description":"Choose δ = ε/3","expression":"\\delta = \\varepsilon/3","hint":"What δ makes 3|x−2| < ε?"},{"stepNumber":3,"description":"Verify: |x−2| < δ ⟹ 3|x−2| < 3·(ε/3) = ε","expression":"3|x-2| < 3\\delta = \\varepsilon","hint":"Substitute δ and confirm the chain of inequalities."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-definition-proof-sketch-82cb278',
  'limits.definition',
  'proof-sketch',
  'free-response',
  'Using the ε-δ definition, prove that $\lim_{x \to 1} (2x+3) = 5$.',
  '{"raw":"Given ε>0, choose δ=ε/2. Then |x−1|<δ implies |(2x+3)−5|=2|x−1|<ε.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Simplify |(2x+3)−5|","expression":"|(2x+3)-5|=2|x-1|","hint":"What is (2x+3)−5?"},{"stepNumber":2,"description":"Choose δ=ε/2","expression":"\\delta=\\varepsilon/2","hint":"You need 2|x−1|<ε."},{"stepNumber":3,"description":"Write the proof","expression":"|x-1|<\\delta \\Rightarrow 2|x-1|<\\varepsilon","hint":"Substitute δ."}]',
  '[{"id":"misc-d18112","description":"Chooses δ=ε without the factor of 2"},{"id":"misc-db2db0","description":"Simplifies |(2x+3)−5| as 2x−2 (drops absolute value)"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-definition-proof-sketch-988b951',
  'limits.definition',
  'proof-sketch',
  'free-response',
  'Prove $\lim_{x \to 2} x^2 = 4$ using ε-δ. (Use preliminary bound $|x-2|<1$.)',
  '{"raw":"Choose δ=min(1,ε/5). If |x-2|<δ≤1 then |x+2|<5, so |x²-4|=|x-2||x+2|<5δ≤ε.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Factor","expression":"|x^2-4|=|x-2||x+2|","hint":"Difference of squares."},{"stepNumber":2,"description":"Bound |x+2| using |x-2|<1","expression":"1<x<3 \\Rightarrow |x+2|<5","hint":"Preliminary restriction."},{"stepNumber":3,"description":"Choose δ=min(1,ε/5)","expression":"\\delta=\\min(1,\\varepsilon/5)","hint":"Ensures 5δ≤ε."},{"stepNumber":4,"description":"Complete proof","expression":"|x^2-4|<5\\delta\\leq\\varepsilon","hint":"Combine bounds."}]',
  '[{"id":"misc-97cfc0","description":"Tries to bound |x+2| without a preliminary restriction"},{"id":"misc-b89b0f","description":"Uses |x+2|<4 without justification"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'lim-infinity-application-ifxop5',
  'limits.infinity',
  'application',
  'free-response',
  'Find all horizontal asymptotes of $f(x) = \dfrac{2x}{\sqrt{x^2+1}}$.',
  '{"raw":"y = 2 and y = -2","latex":"y = 2 \\text{ and } y = -2","type":"text"}',
  '[{"stepNumber":1,"description":"Limit as x → +∞: divide by x (positive)","expression":"\\frac{2}{\\sqrt{1+1/x^2}} \\to 2","hint":"For x > 0, √(x²) = x."},{"stepNumber":2,"description":"Limit as x → −∞: divide by |x| = −x","expression":"\\frac{2}{-\\sqrt{1+1/x^2}} \\to -2","hint":"For x < 0, √(x²) = −x."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-infinity-application-258e509',
  'limits.infinity',
  'application',
  'free-response',
  'Find all horizontal asymptotes of $f(x)=\dfrac{\sqrt{x^2+4}}{x}$.',
  '{"raw":"y=1 as x→+∞ and y=-1 as x→-∞","latex":"y=1 \\text{ and } y=-1","type":"text"}',
  '[{"stepNumber":1,"description":"Limit as x→+∞","expression":"\\frac{\\sqrt{1+4/x^2}}{1}\\to 1","hint":"For x>0, √(x²)=x."},{"stepNumber":2,"description":"Limit as x→−∞","expression":"\\frac{\\sqrt{1+4/x^2}}{-1}\\to -1","hint":"For x<0, √(x²)=−x."},{"stepNumber":3,"description":"Two horizontal asymptotes","expression":"y=1 \\text{ and } y=-1","hint":"Different limits at ±∞."}]',
  '[{"id":"misc-3915f2","description":"Reports only y=1, missing y=−1"},{"id":"misc-b90455","description":"Thinks the limit is 0 because 4/x²→0"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'lim-infinity-conceptual-1ycb5a9',
  'limits.infinity',
  'conceptual',
  'explain-concept',
  'What does $\lim_{x \to \infty} f(x) = 5$ tell you about the graph of f?',
  '{"raw":"The graph has a horizontal asymptote at y = 5","latex":"y = 5 \\text{ is a horizontal asymptote}","type":"text"}',
  '[{"stepNumber":1,"description":"Interpret the limit at infinity","expression":"f(x) \\to 5 \\text{ as } x \\to \\infty","hint":"What does the graph do as x grows without bound?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-infinity-conceptual-6c339c4',
  'limits.infinity',
  'conceptual',
  'explain-concept',
  'What is a horizontal asymptote and how is it related to limits at infinity?',
  '{"raw":"y=L is a horizontal asymptote if lim_{x→∞}f(x)=L or lim_{x→-∞}f(x)=L.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Geometric definition","expression":"","hint":"What does the graph approach as x→±∞?"},{"stepNumber":2,"description":"Limit connection","expression":"\\lim_{x\\to\\infty}f(x)=L \\Leftrightarrow y=L \\text{ is HA}","hint":"Write the limit definition."},{"stepNumber":3,"description":"Two HAs possible","expression":"\\lim_{x\\to+\\infty}f \\neq \\lim_{x\\to-\\infty}f \\text{ is possible}","hint":"Can the limits at ±∞ differ?"}]',
  '[{"id":"misc-87a894","description":"Thinks a function can never cross its horizontal asymptote"},{"id":"misc-a86f6e","description":"Assumes a function has at most one horizontal asymptote"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'lim-infinity-procedural-1ewn0tz',
  'limits.infinity',
  'procedural',
  'free-response',
  'Evaluate $\lim_{x \to \infty} \dfrac{3x^2 + 2x}{5x^2 - 1}$.',
  '{"raw":"3/5","latex":"\\dfrac{3}{5}","type":"numeric"}',
  '[{"stepNumber":1,"description":"Divide numerator and denominator by x²","expression":"\\frac{3 + 2/x}{5 - 1/x^2}","hint":"What is the highest power of x in the denominator?"},{"stepNumber":2,"description":"Take the limit (terms with 1/x → 0)","expression":"\\frac{3 + 0}{5 - 0} = \\frac{3}{5}","hint":"What happens to 2/x and 1/x² as x → ∞?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'lim-infinity-procedural-7qqn94',
  'limits.infinity',
  'procedural',
  'free-response',
  'Evaluate $\lim_{x \to \infty} \dfrac{4x^3 - x}{2x^2 + 7}$.',
  '{"raw":"infinity","latex":"\\infty","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Degree of numerator (3) > degree of denominator (2)","expression":"\\text{degree}(4x^3) > \\text{degree}(2x^2)","hint":"Compare the degrees of numerator and denominator."},{"stepNumber":2,"description":"Limit is ±∞","expression":"\\lim_{x \\to \\infty} \\frac{4x^3}{2x^2} = \\lim_{x \\to \\infty} 2x = \\infty","hint":"What happens when the numerator grows faster?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-infinity-procedural-33a1fd1',
  'limits.infinity',
  'procedural',
  'free-response',
  'Evaluate $\lim_{x\to-\infty}\dfrac{2x}{\sqrt{x^2+1}}$.',
  '{"raw":"-2","latex":"-2","type":"numeric"}',
  '[{"stepNumber":1,"description":"For x<0, divide by |x|=−x","expression":"\\frac{2x/(-x)}{\\sqrt{x^2+1}/\\sqrt{x^2}}=\\frac{-2}{\\sqrt{1+1/x^2}}","hint":"√(x²)=|x|=−x for x<0."},{"stepNumber":2,"description":"Take limit","expression":"\\frac{-2}{1}=-2","hint":"1/x²→0."}]',
  '[{"id":"misc-bd5342","description":"Uses √(x²)=x instead of |x|=−x for x<0"},{"id":"misc-c292d3","description":"Ignores sign change and gets +2"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-infinity-procedural-dbe7963',
  'limits.infinity',
  'procedural',
  'free-response',
  'Evaluate $\lim_{x\to\infty}\dfrac{6x^2-x}{2x^2+3}$.',
  '{"raw":"3","latex":"3","type":"numeric"}',
  '[{"stepNumber":1,"description":"Divide by x²","expression":"\\frac{6-1/x}{2+3/x^2}","hint":"Highest power is x²."},{"stepNumber":2,"description":"Terms with x vanish","expression":"\\frac{6}{2}=3","hint":"1/x→0 as x→∞."}]',
  '[{"id":"misc-6b2926","description":"Adds all coefficients: (6−1)/(2+3)=1"},{"id":"misc-9e7e7c","description":"Concludes ∞/∞=1 without simplifying"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'lim-infinity-proof-sketch-1supboj',
  'limits.infinity',
  'proof-sketch',
  'free-response',
  'Prove that $\lim_{x \to \infty} \dfrac{1}{x} = 0$ using the formal definition.',
  '{"raw":"Given ε > 0, choose N = 1/ε; then x > N implies |1/x - 0| = 1/x < ε","latex":"N = 1/\\varepsilon \\Rightarrow x > N \\Rightarrow 1/x < \\varepsilon","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Write |1/x − 0| = 1/x for x > 0","expression":"|1/x| = 1/x","hint":"Simplify the expression."},{"stepNumber":2,"description":"Choose N = 1/ε","expression":"N = 1/\\varepsilon","hint":"What N makes 1/x < ε for all x > N?"},{"stepNumber":3,"description":"Verify: x > N = 1/ε ⟹ 1/x < ε","expression":"x > \\frac{1}{\\varepsilon} \\Rightarrow \\frac{1}{x} < \\varepsilon","hint":"Take reciprocals (inequality flips)."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-infinity-proof-sketch-99393b0',
  'limits.infinity',
  'proof-sketch',
  'free-response',
  'Prove that $\lim_{x\to\infty}\dfrac{1}{x^n}=0$ for any positive integer $n$.',
  '{"raw":"Given ε>0, choose M=(1/ε)^{1/n}. For x>M, x^n>1/ε, so 1/x^n<ε.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Write the goal","expression":"|1/x^n - 0| = 1/x^n < \\varepsilon","hint":"We need 1/xⁿ<ε."},{"stepNumber":2,"description":"Solve for x","expression":"x^n > 1/\\varepsilon \\Rightarrow x > (1/\\varepsilon)^{1/n}","hint":"Choose M=(1/ε)^{1/n}."},{"stepNumber":3,"description":"Conclude","expression":"x>M \\Rightarrow 1/x^n < \\varepsilon","hint":"The ε-M definition is satisfied."}]',
  '[{"id":"misc-840006","description":"Uses ε-δ instead of ε-M for limits at infinity"},{"id":"misc-b0a2ad","description":"Proves only for n=1 without generalizing"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'lim-lhopital-application-1fd4uvc',
  'limits.lhopital',
  'application',
  'free-response',
  'Evaluate $\lim_{x \to 0} \dfrac{x - \sin x}{x^3}$.',
  '{"raw":"1/6","latex":"\\dfrac{1}{6}","type":"numeric"}',
  '[{"stepNumber":1,"description":"Verify 0/0 form","expression":"0 - \\sin 0 = 0","hint":"Check the form at x = 0."},{"stepNumber":2,"description":"Apply L''Hôpital once: 1 − cos x over 3x²","expression":"\\frac{1 - \\cos x}{3x^2}","hint":"Differentiate numerator and denominator."},{"stepNumber":3,"description":"Apply L''Hôpital again: sin x over 6x","expression":"\\frac{\\sin x}{6x}","hint":"Still 0/0 — apply the rule again."},{"stepNumber":4,"description":"Apply L''Hôpital a third time","expression":"\\frac{\\cos x}{6} \\to \\frac{1}{6}","hint":"One more application."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-lhopital-application-18aa367',
  'limits.lhopital',
  'application',
  'free-response',
  'Evaluate $\lim_{x\to 0^+} x\ln x$ using L''Hôpital''s Rule.',
  '{"raw":"0","latex":"0","type":"numeric"}',
  '[{"stepNumber":1,"description":"Rewrite as ∞/∞","expression":"x\\ln x=\\frac{\\ln x}{1/x}\\to\\frac{-\\infty}{+\\infty}","hint":"Write x=1/(1/x)."},{"stepNumber":2,"description":"Apply L''Hôpital","expression":"\\frac{1/x}{-1/x^2}=-x","hint":"d/dx(ln x)=1/x; d/dx(1/x)=−1/x²."},{"stepNumber":3,"description":"Limit","expression":"-x\\to 0 \\text{ as } x\\to 0^+","hint":"−x→0."}]',
  '[{"id":"misc-666c66","description":"Concludes 0·(−∞)=−∞ without rewriting as fraction"},{"id":"misc-ac9cb6","description":"Tries to apply L''Hôpital directly to x·ln x"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'lim-lhopital-conceptual-osypjq',
  'limits.lhopital',
  'conceptual',
  'explain-concept',
  'When can you apply L''Hôpital''s rule?',
  '{"raw":"When the limit gives 0/0 or ∞/∞","latex":"\\text{Indeterminate forms } 0/0 \\text{ or } \\infty/\\infty","type":"text"}',
  '[{"stepNumber":1,"description":"State the conditions","expression":"\\lim \\frac{f}{g} = \\frac{0}{0} \\text{ or } \\frac{\\infty}{\\infty}","hint":"What forms must the limit take before you can apply the rule?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-lhopital-conceptual-81ac5c5',
  'limits.lhopital',
  'conceptual',
  'explain-concept',
  'State the conditions under which L''Hôpital''s Rule may be applied.',
  '{"raw":"L''Hôpital''s Rule applies when the limit gives 0/0 or ∞/∞, and both f and g are differentiable near c.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Indeterminate forms","expression":"\\frac{0}{0} \\text{ or } \\frac{\\infty}{\\infty}","hint":"What forms trigger L''Hôpital?"},{"stepNumber":2,"description":"Differentiability","expression":"f,g \\text{ differentiable near } c","hint":"What must be true about f and g?"},{"stepNumber":3,"description":"The rule","expression":"\\lim\\frac{f}{g}=\\lim\\frac{f''}{g''}","hint":"Differentiate numerator and denominator separately."}]',
  '[{"id":"misc-7cbb07","description":"Applies quotient rule instead of L''Hôpital''s Rule"},{"id":"misc-f0a794","description":"Applies L''Hôpital''s Rule without checking for 0/0 or ∞/∞"},{"id":"misc-efa343","description":"Differentiates the entire fraction as one expression"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'lim-lhopital-procedural-1klb66o',
  'limits.lhopital',
  'procedural',
  'free-response',
  'Evaluate $\lim_{x \to \infty} \dfrac{\ln x}{x}$.',
  '{"raw":"0","latex":"0","type":"numeric"}',
  '[{"stepNumber":1,"description":"Verify ∞/∞ form","expression":"\\ln x \\to \\infty,\\; x \\to \\infty","hint":"What do numerator and denominator approach?"},{"stepNumber":2,"description":"Apply L''Hôpital","expression":"\\frac{1/x}{1} = \\frac{1}{x}","hint":"Differentiate top and bottom."},{"stepNumber":3,"description":"Evaluate","expression":"\\lim_{x \\to \\infty} \\frac{1}{x} = 0","hint":"What does 1/x approach as x → ∞?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'lim-lhopital-procedural-1ogwojw',
  'limits.lhopital',
  'procedural',
  'free-response',
  'Use L''Hôpital''s rule to evaluate $\lim_{x \to 0} \dfrac{e^x - 1}{x}$.',
  '{"raw":"1","latex":"1","type":"numeric"}',
  '[{"stepNumber":1,"description":"Verify 0/0 form","expression":"e^0 - 1 = 0,\\; x = 0","hint":"What does the numerator equal at x = 0?"},{"stepNumber":2,"description":"Differentiate numerator and denominator","expression":"\\frac{d}{dx}(e^x-1) = e^x,\\quad \\frac{d}{dx}(x) = 1","hint":"What are the derivatives of eˣ − 1 and x?"},{"stepNumber":3,"description":"Evaluate the new limit","expression":"\\lim_{x \\to 0} \\frac{e^x}{1} = 1","hint":"Now substitute x = 0."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-lhopital-procedural-80f6d70',
  'limits.lhopital',
  'procedural',
  'free-response',
  'Apply L''Hôpital''s Rule to $\lim_{x\to 0}\dfrac{\sin(3x)}{x}$.',
  '{"raw":"3","latex":"3","type":"numeric"}',
  '[{"stepNumber":1,"description":"Verify 0/0","expression":"\\frac{\\sin 0}{0}=\\frac{0}{0}","hint":"Is this indeterminate?"},{"stepNumber":2,"description":"Apply L''Hôpital","expression":"\\lim_{x\\to 0}\\frac{3\\cos(3x)}{1}","hint":"d/dx(sin 3x)=3cos 3x."},{"stepNumber":3,"description":"Evaluate","expression":"3\\cos 0=3","hint":"cos(0)=1."}]',
  '[{"id":"misc-95b2ee","description":"Uses lim sin(x)/x=1 and forgets the factor of 3"},{"id":"misc-098eb7","description":"Forgets chain rule factor of 3 when differentiating sin 3x"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-lhopital-procedural-d9ca050',
  'limits.lhopital',
  'procedural',
  'free-response',
  'Use L''Hôpital''s Rule to evaluate $\lim_{x\to\infty}\dfrac{\ln x}{x}$.',
  '{"raw":"0","latex":"0","type":"numeric"}',
  '[{"stepNumber":1,"description":"Verify ∞/∞","expression":"\\frac{\\ln x}{x}\\to\\frac{\\infty}{\\infty}","hint":"Both numerator and denominator → ∞."},{"stepNumber":2,"description":"Apply L''Hôpital","expression":"\\lim_{x\\to\\infty}\\frac{1/x}{1}=\\lim_{x\\to\\infty}\\frac{1}{x}","hint":"d/dx(ln x)=1/x."},{"stepNumber":3,"description":"Evaluate","expression":"\\lim_{x\\to\\infty}1/x=0","hint":"1/x→0 as x→∞."}]',
  '[{"id":"misc-fb9549","description":"Thinks ln x / x → 1 because both go to infinity"},{"id":"misc-2215c0","description":"Gets 1/x and concludes → ∞ (wrong direction)"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-lhopital-procedural-e9e3680',
  'limits.lhopital',
  'procedural',
  'free-response',
  'Apply L''Hôpital''s Rule to $\lim_{x\to 0}\dfrac{e^x-1}{x}$.',
  '{"raw":"1","latex":"1","type":"numeric"}',
  '[{"stepNumber":1,"description":"Verify 0/0","expression":"\\frac{e^0-1}{0}=\\frac{0}{0}","hint":"Is this indeterminate?"},{"stepNumber":2,"description":"Apply L''Hôpital","expression":"\\lim_{x\\to 0}\\frac{e^x}{1}","hint":"d/dx(eˣ−1)=eˣ; d/dx(x)=1."},{"stepNumber":3,"description":"Evaluate","expression":"e^0=1","hint":"Substitute x=0."}]',
  '[{"id":"misc-1c1885","description":"Uses quotient rule on (eˣ−1)/x instead of differentiating separately"},{"id":"misc-149647","description":"Uses power rule on eˣ: writes xe^{x-1}"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'lim-lhopital-proof-sketch-hji4qp',
  'limits.lhopital',
  'proof-sketch',
  'free-response',
  'Explain why L''Hôpital''s rule requires the 0/0 or ∞/∞ form, and give an example where applying it to a non-indeterminate form gives the wrong answer.',
  '{"raw":"The rule derives from Cauchy''s MVT applied to f/g; without the indeterminate form the ratio is already determined. Example: lim_{x→0} x/1 = 0, but applying L''Hôpital gives 1/0 = undefined.","latex":"\\text{Requires indeterminate form; misapplication: }\\lim_{x\\to 0}\\frac{x}{1}\\neq\\frac{1}{0}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"State the hypothesis: f(a) = g(a) = 0 (or both ∞)","expression":"f(a) = g(a) = 0","hint":"What must be true about f and g at the limit point?"},{"stepNumber":2,"description":"Without this, f(a)/g(a) is already defined — no rule needed","expression":"\\frac{f(a)}{g(a)} \\text{ defined} \\Rightarrow \\text{no rule needed}","hint":"If the limit is not indeterminate, what happens?"},{"stepNumber":3,"description":"Counterexample: lim x/1 = 0, but d/dx[x]/d/dx[1] = 1 ≠ 0","expression":"\\lim_{x\\to 0}\\frac{x}{1} = 0 \\neq 1","hint":"Construct a simple example where misapplication gives the wrong answer."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-lhopital-proof-sketch-032534f',
  'limits.lhopital',
  'proof-sketch',
  'free-response',
  'Explain why L''Hôpital''s Rule is not needed for $\lim_{x\to 0}\dfrac{x+\sin x}{x}$ and evaluate it.',
  '{"raw":"2","latex":"2","type":"numeric"}',
  '[{"stepNumber":1,"description":"Split the fraction","expression":"\\frac{x+\\sin x}{x}=1+\\frac{\\sin x}{x}","hint":"Can you split into two terms?"},{"stepNumber":2,"description":"Apply known limit","expression":"\\lim_{x\\to 0}\\frac{\\sin x}{x}=1","hint":"Standard result."},{"stepNumber":3,"description":"Add","expression":"1+1=2","hint":"The first term is just 1."}]',
  '[{"id":"misc-0056ad","description":"Thinks L''Hôpital must be used whenever 0/0 appears"},{"id":"misc-1af98e","description":"Splits (x+sin x)/x as x + sin x / x instead of 1 + sin x / x"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'lim-one-sided-application-eqnkss',
  'limits.one-sided',
  'application',
  'free-response',
  'For $f(x) = \dfrac{|x-3|}{x-3}$, find $\lim_{x \to 3^-} f(x)$ and $\lim_{x \to 3^+} f(x)$.',
  '{"raw":"-1 and 1","latex":"-1 \\text{ and } 1","type":"text"}',
  '[{"stepNumber":1,"description":"For x < 3: |x−3| = −(x−3)","expression":"\\frac{-(x-3)}{x-3} = -1","hint":"What is |x−3| when x < 3?"},{"stepNumber":2,"description":"For x > 3: |x−3| = x−3","expression":"\\frac{x-3}{x-3} = 1","hint":"What is |x−3| when x > 3?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-one-sided-application-487a201',
  'limits.one-sided',
  'application',
  'free-response',
  'Find $k$ so that $\lim_{x\to 2}f(x)$ exists, where $f(x)=\begin{cases}3x+k & x<2\\x^2+1 & x\geq 2\end{cases}$.',
  '{"raw":"k=-1","latex":"k=-1","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Right limit","expression":"\\lim_{x\\to 2^+}(x^2+1)=5","hint":"Substitute x=2 into x²+1."},{"stepNumber":2,"description":"Set left limit = 5","expression":"6+k=5","hint":"For two-sided limit to exist, both sides must agree."},{"stepNumber":3,"description":"Solve","expression":"k=-1","hint":"Simple algebra."}]',
  '[{"id":"misc-8fb934","description":"Uses f(2)=5 from the wrong piece"},{"id":"misc-cf0272","description":"Sets 3x+k=5 at x=0 instead of x=2"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'lim-one-sided-conceptual-s9b9ob',
  'limits.one-sided',
  'conceptual',
  'explain-concept',
  'What is the difference between $\lim_{x \to 2^-} f(x)$ and $\lim_{x \to 2^+} f(x)$?',
  '{"raw":"Left-hand limit approaches from below; right-hand limit approaches from above","latex":"\\text{Left: } x \\to 2^-\\text{; Right: } x \\to 2^+","type":"text"}',
  '[{"stepNumber":1,"description":"Define left-hand limit","expression":"\\lim_{x \\to a^-} f(x)","hint":"Which side of a does x approach from?"},{"stepNumber":2,"description":"Define right-hand limit","expression":"\\lim_{x \\to a^+} f(x)","hint":"And the other side?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-one-sided-conceptual-420c4c9',
  'limits.one-sided',
  'conceptual',
  'explain-concept',
  'List three ways in which $\lim_{x \to c} f(x)$ can fail to exist.',
  '{"raw":"(1) Left and right limits differ. (2) f oscillates. (3) f grows without bound.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Jump discontinuity","expression":"\\lim_{x\\to c^-}f \\neq \\lim_{x\\to c^+}f","hint":"Think of a piecewise function."},{"stepNumber":2,"description":"Oscillation","expression":"\\lim_{x\\to 0}\\sin(1/x)","hint":"Does sin(1/x) settle?"},{"stepNumber":3,"description":"Infinite limit","expression":"\\lim_{x\\to 0^+}1/x=+\\infty","hint":"Does +∞ count as a real number?"}]',
  '[{"id":"misc-6720ef","description":"Thinks limit=+∞ means the limit exists"},{"id":"misc-f656fa","description":"Only identifies jump discontinuity as a reason for DNE"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'lim-one-sided-procedural-1hibucb',
  'limits.one-sided',
  'procedural',
  'free-response',
  'Let $f(x) = \begin{cases} x+1 & x < 2 \\ 3x-2 & x \geq 2 \end{cases}$. Find $\lim_{x \to 2^-} f(x)$ and $\lim_{x \to 2^+} f(x)$.',
  '{"raw":"3 and 4","latex":"3 \\text{ and } 4","type":"text"}',
  '[{"stepNumber":1,"description":"Left-hand limit: use x + 1 branch","expression":"\\lim_{x \\to 2^-}(x+1) = 3","hint":"Which branch applies when x < 2?"},{"stepNumber":2,"description":"Right-hand limit: use 3x − 2 branch","expression":"\\lim_{x \\to 2^+}(3x-2) = 4","hint":"Which branch applies when x ≥ 2?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'lim-one-sided-procedural-ivvf2a',
  'limits.one-sided',
  'procedural',
  'free-response',
  'Does $\lim_{x \to 2} f(x)$ exist for the piecewise function above?',
  '{"raw":"No","latex":"\\text{No — one-sided limits differ}","type":"text"}',
  '[{"stepNumber":1,"description":"Compare one-sided limits","expression":"3 \\neq 4","hint":"What must be true for a two-sided limit to exist?"},{"stepNumber":2,"description":"Conclude","expression":"\\lim_{x \\to 2} f(x) \\text{ does not exist}","hint":"If the one-sided limits differ, what can you say?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-one-sided-procedural-22af22a',
  'limits.one-sided',
  'procedural',
  'free-response',
  'Find $\lim_{x \to 0^-} \dfrac{|x|}{x}$ and $\lim_{x \to 0^+} \dfrac{|x|}{x}$.',
  '{"raw":"Left limit=-1, right limit=1","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"For x<0, |x|=−x","expression":"\\frac{|x|}{x}=\\frac{-x}{x}=-1","hint":"Definition of |x| for negative x."},{"stepNumber":2,"description":"For x>0, |x|=x","expression":"\\frac{|x|}{x}=1","hint":"Definition of |x| for positive x."},{"stepNumber":3,"description":"Two-sided limit DNE","expression":"-1\\neq 1","hint":"One-sided limits disagree."}]',
  '[{"id":"misc-19bd6c","description":"Thinks |x|/x = 1 for all x≠0"},{"id":"misc-c340d7","description":"Substitutes x=0 and gets 0/0"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-one-sided-procedural-e96c248',
  'limits.one-sided',
  'procedural',
  'free-response',
  'Let $f(x)=\begin{cases}x^2-1 & x<3\\2x+1 & x\geq 3\end{cases}$. Find both one-sided limits at $x=3$ and state whether the two-sided limit exists.',
  '{"raw":"Left limit=8, right limit=7, two-sided limit DNE","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Left limit: use x²−1","expression":"\\lim_{x\\to 3^-}(x^2-1)=8","hint":"Which piece for x<3?"},{"stepNumber":2,"description":"Right limit: use 2x+1","expression":"\\lim_{x\\to 3^+}(2x+1)=7","hint":"Which piece for x≥3?"},{"stepNumber":3,"description":"8≠7 so two-sided limit DNE","expression":"","hint":"Both sides must agree."}]',
  '[{"id":"misc-1e0ec4","description":"Uses x≥3 piece for the left-hand limit"},{"id":"misc-7baf77","description":"Reports f(3)=7 as the limit without checking both sides"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'lim-one-sided-proof-sketch-26z14v',
  'limits.one-sided',
  'proof-sketch',
  'free-response',
  'Prove that $\lim_{x \to 0} |x|/x$ does not exist by showing the one-sided limits differ.',
  '{"raw":"Left limit = -1, right limit = 1; since -1 ≠ 1 the two-sided limit does not exist","latex":"L^- = -1 \\neq 1 = L^+ \\Rightarrow \\text{limit DNE}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"For x < 0: |x|/x = −x/x = −1","expression":"\\lim_{x\\to 0^-}\\frac{|x|}{x} = -1","hint":"What is |x| when x < 0?"},{"stepNumber":2,"description":"For x > 0: |x|/x = x/x = 1","expression":"\\lim_{x\\to 0^+}\\frac{|x|}{x} = 1","hint":"What is |x| when x > 0?"},{"stepNumber":3,"description":"One-sided limits differ → limit DNE","expression":"-1 \\neq 1","hint":"What must be true for a two-sided limit to exist?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'limits-one-sided-proof-sketch-4875a9b',
  'limits.one-sided',
  'proof-sketch',
  'free-response',
  'Prove that $\lim_{x \to 0} \dfrac{|x|}{x}$ does not exist.',
  '{"raw":"lim_{x→0⁻}|x|/x=−1 and lim_{x→0⁺}|x|/x=1. Since −1≠1, the two-sided limit DNE.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Left limit","expression":"\\lim_{x\\to 0^-}|x|/x=-1","hint":"For x<0, |x|=−x."},{"stepNumber":2,"description":"Right limit","expression":"\\lim_{x\\to 0^+}|x|/x=1","hint":"For x>0, |x|=x."},{"stepNumber":3,"description":"Conclude DNE","expression":"-1\\neq 1","hint":"State the theorem."}]',
  '[{"id":"misc-4c72fc","description":"Defines |x| incorrectly for negative x"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'ode-first-order-linear-application-e2fb0b1',
  'ode.first-order-linear',
  'application',
  'free-response',
  'Newton''s Law of Cooling: $dT/dt=-k(T-25)$, $T(0)=100$°C, $T(10)=75$°C. Find $T(t)$ and $k$.',
  '{"raw":"T(t)=25+75e^{-kt}; k=ln(3/2)/10≈0.0405","latex":"T(t)=25+75e^{-kt},\\;k=\\dfrac{\\ln(3/2)}{10}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Shift: u=T−25","expression":"u(t)=75e^{-kt}","hint":"T(0)−25=75."},{"stepNumber":2,"description":"T(t)=25+75e^{-kt}","expression":"","hint":"Add ambient temperature."},{"stepNumber":3,"description":"Use T(10)=75","expression":"75=25+75e^{-10k}\\Rightarrow k=\\ln(3/2)/10","hint":"Solve for k."}]',
  '[{"id":"misc-89fb04","description":"Solves dT/dt=−kT instead of dT/dt=−k(T−25)"},{"id":"misc-ba99db","description":"Computes k from T(0)=100 instead of T(10)=75"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'ode-first-order-linear-application-tm8gz',
  'ode.first-order-linear',
  'application',
  'free-response',
  'A tank contains 100 L of pure water. Brine with 0.5 kg/L flows in at 2 L/min; the well-mixed solution drains at 2 L/min. Find the salt amount $A(t)$ with $A(0) = 0$.',
  '{"raw":"A(t) = 50(1 - e^(-t/50))","latex":"A(t) = 50(1 - e^{-t/50})","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Rate in = 0.5·2 = 1 kg/min; Rate out = (A/100)·2 = A/50 kg/min","expression":"\\frac{dA}{dt} = 1 - \\frac{A}{50}","hint":"Write the ODE for salt: dA/dt = rate in − rate out."},{"stepNumber":2,"description":"Standard form: dA/dt + A/50 = 1; μ = e^(t/50)","expression":"\\mu = e^{t/50}","hint":"Find the integrating factor."},{"stepNumber":3,"description":"Solve and apply A(0) = 0","expression":"A(t) = 50(1 - e^{-t/50})","hint":"Integrate and apply the initial condition."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'ode-first-order-linear-conceptual-1s3ee2a',
  'ode.first-order-linear',
  'conceptual',
  'explain-concept',
  'What is the integrating factor for $\dfrac{dy}{dx} + P(x)y = Q(x)$?',
  '{"raw":"μ(x) = e^(∫P(x)dx)","latex":"\\mu(x) = e^{\\int P(x)\\,dx}","type":"text"}',
  '[{"stepNumber":1,"description":"Standard form: dy/dx + P(x)y = Q(x)","expression":"\\frac{dy}{dx} + P(x)y = Q(x)","hint":"What is the standard form of a first-order linear ODE?"},{"stepNumber":2,"description":"Integrating factor: μ = e^(∫P dx)","expression":"\\mu(x) = e^{\\int P(x)\\,dx}","hint":"What function, when multiplied through, makes the left side an exact derivative?"}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'ode-first-order-linear-conceptual-7f5c346',
  'ode.first-order-linear',
  'conceptual',
  'explain-concept',
  'What is an integrating factor and why is it used for first-order linear ODEs?',
  '{"raw":"The integrating factor μ(x)=e^{∫P(x)dx} converts y''+P(x)y=Q(x) into d/dx[μy]=μQ, which can be integrated directly.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Standard form","expression":"y''+P(x)y=Q(x)","hint":"Write ODE in standard form."},{"stepNumber":2,"description":"Integrating factor","expression":"\\mu(x)=e^{\\int P(x)dx}","hint":"Makes left side a perfect derivative."},{"stepNumber":3,"description":"After multiplication","expression":"\\frac{d}{dx}[\\mu y]=\\mu Q","hint":"Left side becomes d/dx(μy)."}]',
  '[{"id":"misc-8a2556","description":"Uses P(x) itself as the integrating factor instead of e^{∫P dx}"},{"id":"misc-bd02a0","description":"Tries to use integrating factor on a separable ODE"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'ode-first-order-linear-procedural-1cbovug',
  'ode.first-order-linear',
  'procedural',
  'free-response',
  'Solve $\dfrac{dy}{dx} + 2y = 4$.',
  '{"raw":"y = 2 + Ce^(-2x)","latex":"y = 2 + Ce^{-2x}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"P(x) = 2; μ = e^(2x)","expression":"\\mu = e^{2x}","hint":"What is the integrating factor?"},{"stepNumber":2,"description":"Multiply through: d/dx[e^(2x)y] = 4e^(2x)","expression":"\\frac{d}{dx}[e^{2x}y] = 4e^{2x}","hint":"Multiply both sides by μ."},{"stepNumber":3,"description":"Integrate: e^(2x)y = 2e^(2x) + C","expression":"e^{2x}y = 2e^{2x} + C","hint":"Integrate both sides."},{"stepNumber":4,"description":"Solve: y = 2 + Ce^(−2x)","expression":"y = 2 + Ce^{-2x}","hint":"Divide by e^(2x)."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'ode-first-order-linear-procedural-3868f3e',
  'ode.first-order-linear',
  'procedural',
  'free-response',
  'Solve $xy''+y=x^2$ for $x>0$.',
  '{"raw":"y=x^2/3+C/x","latex":"y=\\dfrac{x^2}{3}+\\dfrac{C}{x}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Standard form","expression":"y''+(1/x)y=x","hint":"Divide by x."},{"stepNumber":2,"description":"IF: μ=e^{∫1/x dx}=x","expression":"\\mu=x","hint":"∫1/x dx=ln x."},{"stepNumber":3,"description":"Multiply and integrate","expression":"xy=x^3/3+C","hint":"∫x² dx=x³/3."},{"stepNumber":4,"description":"Solve","expression":"y=x^2/3+C/x","hint":"Divide by x."}]',
  '[{"id":"misc-f0898d","description":"Applies IF without first writing in standard form"},{"id":"misc-394ca4","description":"Uses μ=x² instead of μ=x"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'ode-first-order-linear-procedural-74538a4',
  'ode.first-order-linear',
  'procedural',
  'free-response',
  'Solve $y''+3y=6$, $y(0)=0$.',
  '{"raw":"y=2(1-e^{-3x})","latex":"y=2(1-e^{-3x})","type":"symbolic"}',
  '[{"stepNumber":1,"description":"IF: μ=e^{3x}","expression":"\\mu=e^{3x}","hint":"P(x)=3."},{"stepNumber":2,"description":"Multiply and integrate","expression":"e^{3x}y=2e^{3x}+C","hint":"∫6e^{3x}dx=2e^{3x}."},{"stepNumber":3,"description":"Apply IC","expression":"y=2+Ce^{-3x};\\;y(0)=0\\Rightarrow C=-2","hint":"Substitute x=0, y=0."}]',
  '[{"id":"misc-034f05","description":"Uses μ=e^3 (constant) instead of e^{3x}"},{"id":"misc-20bb48","description":"Integrates 6e^{3x} as 6e^{3x} without the 1/3 factor"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'ode-first-order-linear-procedural-w4nqpl',
  'ode.first-order-linear',
  'procedural',
  'free-response',
  'Solve $x\dfrac{dy}{dx} + y = x^2$ for $x > 0$.',
  '{"raw":"y = x^2/3 + C/x","latex":"y = \\dfrac{x^2}{3} + \\dfrac{C}{x}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Divide by x: dy/dx + y/x = x","expression":"\\frac{dy}{dx} + \\frac{1}{x}y = x","hint":"Write in standard form."},{"stepNumber":2,"description":"μ = e^(∫1/x dx) = x","expression":"\\mu = x","hint":"Compute the integrating factor."},{"stepNumber":3,"description":"Multiply: d/dx[xy] = x²","expression":"\\frac{d}{dx}[xy] = x^2","hint":"Multiply through by μ = x."},{"stepNumber":4,"description":"Integrate and solve","expression":"xy = \\frac{x^3}{3} + C \\Rightarrow y = \\frac{x^2}{3} + \\frac{C}{x}","hint":"Integrate and divide by x."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'ode-first-order-linear-proof-sketch-1fqkn8n',
  'ode.first-order-linear',
  'proof-sketch',
  'free-response',
  'Derive the integrating factor method: show that multiplying $\dfrac{dy}{dx} + P(x)y = Q(x)$ by $\mu = e^{\int P\,dx}$ makes the left side an exact derivative.',
  '{"raw":"μy'' + μPy = (μy)'' because μ'' = μP; so d/dx[μy] = μQ; integrate both sides","latex":"\\mu = e^{\\int P\\,dx} \\Rightarrow \\frac{d}{dx}[\\mu y] = \\mu Q","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Multiply through by μ: μy'' + μPy = μQ","expression":"\\mu y'' + \\mu P y = \\mu Q","hint":"Multiply both sides by μ."},{"stepNumber":2,"description":"Note μ'' = μP (since μ = e^(∫P dx))","expression":"\\mu'' = \\mu P","hint":"Differentiate μ = e^(∫P dx)."},{"stepNumber":3,"description":"So μy'' + μ''y = (μy)'' = μQ","expression":"\\frac{d}{dx}[\\mu y] = \\mu Q","hint":"Recognise the product rule in reverse."},{"stepNumber":4,"description":"Integrate both sides to solve for y","expression":"\\mu y = \\int \\mu Q\\,dx + C","hint":"Integrate and divide by μ."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'ode-first-order-linear-proof-sketch-ec901f9',
  'ode.first-order-linear',
  'proof-sketch',
  'free-response',
  'Derive the integrating factor method for $y''+P(x)y=Q(x)$.',
  '{"raw":"Multiply by μ(x). Want d/dx(μy)=μQ, so μ''+μP=0 is wrong — we need μ''=μP, i.e., μ=e^{∫P dx}.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Multiply by μ","expression":"\\mu y''+\\mu Py=\\mu Q","hint":"We want left side to be d/dx(μy)."},{"stepNumber":2,"description":"Expand d/dx(μy)","expression":"\\frac{d}{dx}(\\mu y)=\\mu y''+\\mu''y","hint":"Product rule."},{"stepNumber":3,"description":"Require μ''=μP","expression":"\\mu''=\\mu P\\Rightarrow\\ln\\mu=\\int P\\,dx","hint":"This is a separable ODE for μ."},{"stepNumber":4,"description":"Solve","expression":"\\mu=e^{\\int P\\,dx}","hint":"Exponentiate."}]',
  '[{"id":"misc-d979a7","description":"Does not use product rule to justify why μ''=μP is needed"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'ode-separable-application-1lscbak',
  'ode.separable',
  'application',
  'free-response',
  'A population grows at rate $\dfrac{dP}{dt} = 0.03P$. If $P(0) = 500$, find $P(t)$.',
  '{"raw":"P(t) = 500*e^(0.03t)","latex":"P(t) = 500e^{0.03t}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Separate: dP/P = 0.03 dt","expression":"\\frac{dP}{P} = 0.03\\,dt","hint":"Separate variables."},{"stepNumber":2,"description":"Integrate: ln P = 0.03t + C","expression":"\\ln P = 0.03t + C","hint":"Integrate both sides."},{"stepNumber":3,"description":"P = Ae^(0.03t); P(0) = 500 → A = 500","expression":"P(t) = 500e^{0.03t}","hint":"Apply the initial condition."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'ode-separable-application-4625df7',
  'ode.separable',
  'application',
  'free-response',
  'A population satisfies $dP/dt=0.04P$, $P(0)=500$. Find $P(t)$ and the doubling time.',
  '{"raw":"P(t)=500e^{0.04t}; doubling time=ln(2)/0.04≈17.3","latex":"P(t)=500e^{0.04t},\\;t=\\dfrac{\\ln 2}{0.04}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Solve ODE","expression":"P(t)=Ce^{0.04t}","hint":"Standard exponential growth."},{"stepNumber":2,"description":"Apply IC","expression":"C=500","hint":"P(0)=500."},{"stepNumber":3,"description":"Doubling time","expression":"1000=500e^{0.04t}\\Rightarrow t=\\ln(2)/0.04\\approx 17.3","hint":"Set P=1000."}]',
  '[{"id":"misc-29ae4c","description":"Computes doubling time as 1/0.04=25 instead of ln(2)/0.04"},{"id":"misc-7859ec","description":"Solves dP/dt=0.04P as P=0.04Pt+500 (linear growth)"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'ode-separable-conceptual-1b3s9i8',
  'ode.separable',
  'conceptual',
  'explain-concept',
  'What makes a differential equation "separable"?',
  '{"raw":"It can be written as dy/dx = f(x)g(y), separating x and y to opposite sides","latex":"\\frac{dy}{dx} = f(x)g(y) \\Rightarrow \\frac{dy}{g(y)} = f(x)\\,dx","type":"text"}',
  '[{"stepNumber":1,"description":"A separable ODE has the form dy/dx = f(x)g(y)","expression":"\\frac{dy}{dx} = f(x)g(y)","hint":"Can you write the right side as a product of a function of x and a function of y?"},{"stepNumber":2,"description":"Separate variables: dy/g(y) = f(x)dx","expression":"\\frac{dy}{g(y)} = f(x)\\,dx","hint":"Move all y terms to one side and all x terms to the other."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'ode-separable-conceptual-3ce9480',
  'ode.separable',
  'conceptual',
  'explain-concept',
  'What does it mean for a differential equation to be separable? Give examples.',
  '{"raw":"Separable: dy/dx=f(x)g(y) — can write g(y)⁻¹dy=f(x)dx. Example: dy/dx=xy. Non-separable: dy/dx=x+y.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Definition","expression":"\\frac{dy}{dx}=f(x)g(y)","hint":"Can you separate x and y?"},{"stepNumber":2,"description":"Separable example","expression":"\\frac{dy}{dx}=xy\\Rightarrow\\frac{dy}{y}=x\\,dx","hint":"Divide by y."},{"stepNumber":3,"description":"Non-separable example","expression":"\\frac{dy}{dx}=x+y \\text{ — cannot factor}","hint":"Try to write x+y as a product."}]',
  '[{"id":"misc-0e72df","description":"Tries to separate dy/dx=x+y as if it were a product"},{"id":"misc-ea0594","description":"Confuses separable ODEs with linear ODEs"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'ode-separable-procedural-1o1ovn1',
  'ode.separable',
  'procedural',
  'free-response',
  'Solve $\dfrac{dy}{dx} = \dfrac{x}{y}$.',
  '{"raw":"y^2 = x^2 + C","latex":"y^2 = x^2 + C","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Separate: y dy = x dx","expression":"y\\,dy = x\\,dx","hint":"Multiply both sides by y and by dx."},{"stepNumber":2,"description":"Integrate: y²/2 = x²/2 + C₁","expression":"\\frac{y^2}{2} = \\frac{x^2}{2} + C_1","hint":"Integrate both sides."},{"stepNumber":3,"description":"Simplify: y² = x² + C","expression":"y^2 = x^2 + C","hint":"Multiply through by 2 and absorb the constant."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'ode-separable-procedural-6fi4p7',
  'ode.separable',
  'procedural',
  'free-response',
  'Solve $\dfrac{dy}{dx} = 2xy$ with $y(0) = 1$.',
  '{"raw":"y = e^(x^2)","latex":"y = e^{x^2}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Separate: dy/y = 2x dx","expression":"\\frac{dy}{y} = 2x\\,dx","hint":"Divide both sides by y and multiply by dx."},{"stepNumber":2,"description":"Integrate both sides: ln|y| = x²+C","expression":"\\ln|y| = x^2 + C","hint":"Integrate each side."},{"stepNumber":3,"description":"Exponentiate: y = Ae^(x²)","expression":"y = Ae^{x^2}","hint":"Solve for y."},{"stepNumber":4,"description":"Apply y(0) = 1: A = 1","expression":"y = e^{x^2}","hint":"Use the initial condition to find A."}]',
  '[]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'ode-separable-procedural-74ebfcc',
  'ode.separable',
  'procedural',
  'free-response',
  'Solve $\dfrac{dy}{dx}=\dfrac{x}{y}$, $y(0)=2$.',
  '{"raw":"y=sqrt(x^2+4)","latex":"y=\\sqrt{x^2+4}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Separate","expression":"y\\,dy=x\\,dx","hint":"Multiply by y and dx."},{"stepNumber":2,"description":"Integrate","expression":"y^2/2=x^2/2+C","hint":"∫y dy=y²/2."},{"stepNumber":3,"description":"Apply IC","expression":"C=2","hint":"y(0)=2."},{"stepNumber":4,"description":"Solve","expression":"y=\\sqrt{x^2+4}","hint":"Take positive root since y(0)=2>0."}]',
  '[{"id":"misc-33a246","description":"Integrates dy/dx=x/y as if it were dy/dx=x"},{"id":"misc-f7c6a0","description":"Takes negative root despite y(0)=2>0"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'ode-separable-procedural-f66647b',
  'ode.separable',
  'procedural',
  'free-response',
  'Solve the IVP $\dfrac{dy}{dx}=2xy$, $y(0)=3$.',
  '{"raw":"y=3e^{x^2}","latex":"y=3e^{x^2}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Separate","expression":"\\frac{dy}{y}=2x\\,dx","hint":"Divide by y."},{"stepNumber":2,"description":"Integrate","expression":"\\ln|y|=x^2+C","hint":"∫dy/y=ln|y|."},{"stepNumber":3,"description":"Exponentiate","expression":"y=Ae^{x^2}","hint":"Let A=eᶜ."},{"stepNumber":4,"description":"Apply IC","expression":"A=3","hint":"y(0)=3."}]',
  '[{"id":"misc-eee757","description":"Forgets constant of integration C"},{"id":"misc-64568d","description":"Writes y=x²+C instead of exponentiating"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'ode-separable-proof-sketch-346d975',
  'ode.separable',
  'proof-sketch',
  'free-response',
  'Show that the general solution to $dy/dx=ky$ is $y=Ce^{kx}$.',
  '{"raw":"Separate: dy/y=k dx. Integrate: ln|y|=kx+C₁. Exponentiate: y=Ce^{kx}.","latex":"","type":"text"}',
  '[{"stepNumber":1,"description":"Separate","expression":"\\frac{dy}{y}=k\\,dx","hint":"Assume y≠0."},{"stepNumber":2,"description":"Integrate","expression":"\\ln|y|=kx+C_1","hint":"∫dy/y=ln|y|."},{"stepNumber":3,"description":"Exponentiate","expression":"y=Ce^{kx}","hint":"Let C=±e^{C₁}."},{"stepNumber":4,"description":"y=0 also a solution","expression":"\\frac{d}{dx}(0)=0=k\\cdot 0","hint":"Check trivial solution."}]',
  '[{"id":"misc-b41d8f","description":"Writes y=e^{kx} without constant C"},{"id":"misc-c997f7","description":"Separates as dy=ky dx and integrates to y=kxy"}]',
  0
);

INSERT OR IGNORE INTO problems (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated) VALUES (
  'ode-separable-proof-sketch-mc1vxe',
  'ode.separable',
  'proof-sketch',
  'free-response',
  'Prove that $y = Ce^{kx}$ is the general solution to $\dfrac{dy}{dx} = ky$.',
  '{"raw":"Separate: dy/y = k dx; integrate: ln|y| = kx + C₁; exponentiate: y = Ce^(kx) where C = ±e^(C₁)","latex":"y = Ce^{kx}","type":"symbolic"}',
  '[{"stepNumber":1,"description":"Separate variables: dy/y = k dx","expression":"\\frac{dy}{y} = k\\,dx","hint":"Divide both sides by y."},{"stepNumber":2,"description":"Integrate: ln|y| = kx + C₁","expression":"\\ln|y| = kx + C_1","hint":"Integrate both sides."},{"stepNumber":3,"description":"Exponentiate: y = ±e^(C₁)e^(kx) = Ce^(kx)","expression":"y = Ce^{kx}","hint":"Solve for y, absorbing the sign into C."},{"stepNumber":4,"description":"Verify by substitution: dy/dx = kCe^(kx) = ky ✓","expression":"y'' = kCe^{kx} = ky","hint":"Check the solution satisfies the ODE."}]',
  '[]',
  0
);

COMMIT;

-- Verify
SELECT concept_id, difficulty, COUNT(*) as count FROM problems GROUP BY concept_id, difficulty ORDER BY concept_id, difficulty;