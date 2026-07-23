"""Multiplayer Elo rating for rated contests (S5).

This is deliberately NOT the real Codeforces algorithm. Codeforces computes a
per-contestant "seed" (expected rank given everyone's rating), binary-searches
for a performance rating that would have produced the contestant's actual
rank against that seed, then blends old and performance ratings with extra
correction passes to keep the field's rating sum roughly stable. That's a lot
of machinery to build and to trust without CF's own reference data to verify
against.

Instead, every contestant is treated as having played a 1-on-1 Elo match
against every other contestant, with the outcome decided purely by final
rank (lower rank number wins; equal rank is a draw). A contestant's rating
change is the average per-opponent Elo delta (standard 400-point logistic
expected score), scaled by K. This is:

- Deterministic and simple enough to unit-test exhaustively.
- Naturally (near-)zero-sum for a full field: what one contestant gains,
  their beaten opponents collectively lose, modulo integer rounding.
- Well documented and honest about being a simplification, rather than an
  unverified reimplementation of a famously intricate algorithm.
"""

from dataclasses import dataclass

_K = 32


@dataclass(frozen=True)
class RatingEntrant:
    user_id: object
    rating: int
    rank: int


def compute_rating_deltas(entrants: list[RatingEntrant]) -> dict[object, int]:
    """Return {user_id: rating_delta} for one finished rated contest.

    rank is 1-indexed, lower is better; equal ranks are treated as a draw
    for that pair. Fewer than 2 entrants produces no-op deltas (0), since a
    single contestant has no opponents to be rated against.
    """
    n = len(entrants)
    if n < 2:
        return {e.user_id: 0 for e in entrants}

    deltas: dict[object, int] = {}
    for a in entrants:
        total = 0.0
        for b in entrants:
            if b is a:
                continue
            expected = 1.0 / (1.0 + 10 ** ((b.rating - a.rating) / 400.0))
            if a.rank < b.rank:
                actual = 1.0
            elif a.rank > b.rank:
                actual = 0.0
            else:
                actual = 0.5
            total += actual - expected
        deltas[a.user_id] = round(_K * total / (n - 1))
    return deltas
