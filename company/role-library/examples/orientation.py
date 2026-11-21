"""Exact 2D orientation for integer/rational input, not a mesh validity proof.

Run: python3 company/role-library/examples/orientation.py
Decimals must be strings, so a binary float is never mislabeled exact decimal.
"""
from fractions import Fraction


def rational(value):
    if isinstance(value, bool) or not isinstance(value, (int, str, Fraction)):
        raise ValueError("Use an integer, rational string or Fraction")
    return Fraction(value)


def orientation(a, b, c):
    ax, ay = map(rational, a)
    bx, by = map(rational, b)
    cx, cy = map(rational, c)
    determinant = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
    return (determinant > 0) - (determinant < 0)


if __name__ == "__main__":
    assert orientation((0, 0), (1, 0), (0, 1)) == 1
    assert orientation((0, 0), (0, 1), (1, 0)) == -1
    assert orientation((0, 0), (1, 1), (2, 2)) == 0
    assert orientation(("0.1", "0.1"), ("0.2", "0.2"), ("0.3", "0.3")) == 0
    print("Four exact orientation examples passed; no general geometric claim was tested.")
