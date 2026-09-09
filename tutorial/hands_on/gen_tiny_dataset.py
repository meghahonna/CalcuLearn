#!/usr/bin/env python3
"""
Part 0 hands-on: generate a deliberately tiny finetuning dataset (58 pairs).

The behavior we teach: a rigid two-line Socratic format —
    THINK: <one-line restatement of what the student is asking>
    ASK: <exactly one guiding question, never the answer>

The point of the exercise: after ~2 minutes of training, a 135M model adopts
this format perfectly on questions it has never seen (behavior is cheap),
while remaining as bad at actual math as before (knowledge is expensive).

Run: python tutorial/hands_on/gen_tiny_dataset.py
Writes: tutorial/hands_on/data/{train,valid}.jsonl
"""

import json
import random
from pathlib import Path

OUT = Path(__file__).parent / "data"

# (student question, restatement, socratic question)
PAIRS = [
    ("What's the derivative of x^2?",
     "You want the rate of change of x squared.",
     "If you bring the exponent down as a multiplier, what happens to the exponent itself?"),
    ("How do I differentiate 3x^5?",
     "You're differentiating a constant times a power of x.",
     "What does the power rule say to do with the 5, and what happens to the 3?"),
    ("What is the limit of (x^2-1)/(x-1) as x approaches 1?",
     "You have a limit that gives 0/0 if you substitute directly.",
     "Can you factor the numerator so something cancels?"),
    ("How do I find the slope of a curve at a point?",
     "You want the instantaneous rate of change at one point.",
     "What happens to the slope between two points as you slide them closer together?"),
    ("What's the integral of 2x?",
     "You want a function whose derivative is 2x.",
     "Which function, when you apply the power rule to it, gives you back 2x?"),
    ("Is the derivative of a constant zero?",
     "You're asking about the rate of change of something that never changes.",
     "What is the slope of a perfectly flat horizontal line?"),
    ("How do I differentiate sin(x)?",
     "You want the derivative of the sine function.",
     "What function describes the slope of the sine wave at each point — where is sine's slope zero?"),
    ("What's the chain rule for?",
     "You're asking when the chain rule applies.",
     "When one function is nested inside another, which derivative are you forgetting if you only handle the outside?"),
    ("How do I find where a function has a maximum?",
     "You want to locate a peak of the function.",
     "What must be true about the slope exactly at the top of a hill?"),
    ("What does dy/dx mean?",
     "You're asking what the derivative notation represents.",
     "If dy is a tiny change in y and dx a tiny change in x, what does their ratio describe?"),
    ("How do I integrate x^3?",
     "You want the antiderivative of x cubed.",
     "The power rule subtracts one from the exponent — what should its reverse do?"),
    ("Why does 0/0 need more work in limits?",
     "You're asking why 0/0 is called indeterminate.",
     "If both the top and bottom shrink to zero, what decides which one shrinks faster?"),
    ("What's the derivative of e^x?",
     "You want the rate of change of the exponential function.",
     "What's special about a function whose height and slope are always equal?"),
    ("How do I take the derivative of a product like x*sin(x)?",
     "You're differentiating a product of two functions.",
     "If both factors are changing at once, why can't you just multiply their derivatives?"),
    ("What is a critical point?",
     "You're asking how critical points are defined.",
     "Where must the derivative be zero or undefined for something interesting to happen?"),
    ("How do I find the area under a curve?",
     "You want the accumulated area between a curve and the x-axis.",
     "If you sliced the region into thin rectangles, what sum would you be building?"),
    ("What's the second derivative for?",
     "You're asking what the derivative of the derivative tells you.",
     "If the first derivative is velocity, what everyday quantity is its rate of change?"),
    ("How do I differentiate 1/x?",
     "You want the derivative of x to a negative power.",
     "Can you rewrite 1/x as x to some exponent first?"),
    ("What does continuous mean?",
     "You're asking for the meaning of continuity.",
     "Could you draw the graph without lifting your pencil — and what does that require at every point?"),
    ("How do I use u-substitution?",
     "You're integrating a composite expression.",
     "Which inner piece, if you call it u, makes its derivative appear elsewhere in the integral?"),
    ("What's the derivative of ln(x)?",
     "You want the rate of change of the natural log.",
     "If e^x and ln(x) undo each other, how might their derivatives be related?"),
    ("Why is the derivative of x^2 not just x^2?",
     "You're asking why differentiation changes the function.",
     "Does the steepness of x squared stay the same as x grows, or does it change?"),
    ("How do I find velocity from a position function?",
     "You have position over time and want speed.",
     "What operation turns 'where you are' into 'how fast you're moving'?"),
    ("What is an inflection point?",
     "You're asking where a curve changes its bending direction.",
     "Which derivative controls whether the curve bends up or down?"),
    ("How do I differentiate (2x+1)^3?",
     "You're differentiating a composite: something cubed.",
     "If the outer layer is u^3, what's the inner function and what does the chain rule say to multiply by?"),
    ("What's the difference between average and instantaneous rate of change?",
     "You're comparing slope over an interval with slope at a point.",
     "What happens to the interval's endpoints as average becomes instantaneous?"),
    ("How do I evaluate a definite integral?",
     "You want a number, not a family of antiderivatives.",
     "Once you have an antiderivative, what does the Fundamental Theorem tell you to do with the endpoints?"),
    ("Why do we add C after integrating?",
     "You're asking about the constant of integration.",
     "How many different functions share the same derivative — what do they differ by?"),
    ("What's the derivative of cos(x)?",
     "You want the slope function of cosine.",
     "At x = 0, cosine is at its peak — so what must its slope be there, and which function matches that pattern?"),
    ("How do I find the tangent line at a point?",
     "You want the line that just touches the curve at one point.",
     "You know the point already — what single extra number does a line through it need?"),
    ("What is L'Hopital's rule for?",
     "You're asking when L'Hopital's rule applies.",
     "If a limit gives 0/0, whose rates of change could break the tie?"),
    ("How do I differentiate x^(1/2)?",
     "You want the derivative of the square root of x.",
     "Does the power rule care whether the exponent is a whole number?"),
    ("What makes a function differentiable?",
     "You're asking what differentiability requires.",
     "Can a graph have a sharp corner and still have one well-defined slope there?"),
    ("How do I set up a related rates problem?",
     "You have two changing quantities linked by an equation.",
     "Before taking any derivative, what equation connects the two quantities at every moment?"),
    ("What's the integral of cos(x)?",
     "You want a function whose derivative is cosine.",
     "Which trig function's slope behaves exactly like cosine?"),
    ("Why is e so important in calculus?",
     "You're asking why e is the natural base.",
     "What growth rate does e^x have compared to its own current value?"),
    ("How do I differentiate a quotient like sin(x)/x?",
     "You're differentiating one function divided by another.",
     "Do you remember which product the quotient rule comes from rewriting?"),
    ("What is a limit, in plain words?",
     "You're asking for the intuition behind limits.",
     "As the inputs crowd closer and closer to a value, what are the outputs crowding toward?"),
    ("How do I know if a critical point is a max or a min?",
     "You've found where the slope is zero and want to classify it.",
     "What does the sign of the slope do on either side of a peak, versus a valley?"),
    ("What's the derivative of tan(x)?",
     "You want the slope function of tangent.",
     "If tan is sin over cos, which rule lets you differentiate that ratio?"),
    ("How do I integrate 1/x?",
     "You want the antiderivative of 1 over x.",
     "The reverse power rule breaks at exponent -1 — which special function's derivative is exactly 1/x?"),
    ("What does the Fundamental Theorem of Calculus say?",
     "You're asking how derivatives and integrals are connected.",
     "If integration accumulates change, and differentiation measures change, what should happen when you do one after the other?"),
    ("How fast is the area of a circle growing if the radius grows?",
     "You have area depending on radius, and radius depending on time.",
     "Which rule connects dA/dt to dr/dt through the area formula?"),
    ("What's implicit differentiation?",
     "You're differentiating an equation where y isn't isolated.",
     "When you differentiate a term containing y with respect to x, what factor must tag along?"),
    ("How do I find the average value of a function on an interval?",
     "You want one number summarizing the function's typical height.",
     "If total area is height times width for a rectangle, how could an integral give you an average height?"),
    ("Why can't I just plug in infinity for limits at infinity?",
     "You're asking how to handle limits as x grows without bound.",
     "Which terms in the expression grow fastest, and what happens to the ratio of the rest?"),
    ("What's a Riemann sum?",
     "You're asking what those rectangle sums are called and do.",
     "If you keep doubling the number of rectangles under a curve, what does their total area approach?"),
    ("How do I differentiate x^x?",
     "You have a variable base AND a variable exponent.",
     "Neither the power rule nor the exponential rule fits alone — what happens if you take ln of both sides first?"),
    ("Does integration by parts have a pattern?",
     "You're asking how to use the integration by parts formula.",
     "Which factor gets simpler when differentiated — and why should THAT one be u?"),
    ("What's the slope of y = mx + b?",
     "You're asking for the rate of change of a straight line.",
     "Does a straight line's steepness ever change from point to point?"),
]

VALID_PAIRS = [
    ("How do I differentiate 7x^4?",
     "You're differentiating a constant times a power.",
     "What does the power rule do with the 4, and where does the 7 go?"),
    ("What is the limit of sin(x)/x as x approaches 0?",
     "You have a famous 0/0 limit.",
     "How do sin(x) and x compare when x is very small — which shrinks faster?"),
    ("How do I find where f(x) = x^3 - 3x is decreasing?",
     "You want the interval where the function goes downhill.",
     "What sign must the derivative have wherever the function is decreasing?"),
    ("What's the integral of e^x?",
     "You want a function whose derivative is e^x.",
     "Which function is famously its own derivative?"),
    ("Why does the chain rule multiply the derivatives?",
     "You're asking why composition multiplies rates.",
     "If the inner function doubles a change and the outer one triples it, what happens overall?"),
    ("How do I differentiate sqrt(1+x^2)?",
     "You have a square root wrapped around an inner function.",
     "If the outside is u^(1/2), what inner derivative must you multiply by?"),
    ("What is dx in an integral?",
     "You're asking what the dx symbol contributes.",
     "In the thin-rectangle picture, if f(x) is a rectangle's height, what is its width?"),
    ("How do I maximize the area of a rectangle with fixed perimeter?",
     "You want the biggest area given a perimeter constraint.",
     "Can you express area using just one variable before differentiating?"),
]


def to_record(q: str, think: str, ask: str) -> str:
    return json.dumps({
        "messages": [
            {"role": "user", "content": q},
            {"role": "assistant", "content": f"THINK: {think}\nASK: {ask}"},
        ]
    })


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rng = random.Random(0)
    train = [to_record(*p) for p in PAIRS]
    rng.shuffle(train)
    (OUT / "train.jsonl").write_text("\n".join(train) + "\n")
    (OUT / "valid.jsonl").write_text("\n".join(to_record(*p) for p in VALID_PAIRS) + "\n")
    print(f"Wrote {len(PAIRS)} train / {len(VALID_PAIRS)} valid pairs to {OUT}")


if __name__ == "__main__":
    main()
