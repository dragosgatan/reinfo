"""multiplayer elo rating for rated contests; simplified pairwise 1v1 elo by final rank, not the real codeforces algorithm"""

from dataclasses import dataclass

_K = 32


@dataclass(frozen=True)
class RatingEntrant:
    user_id: object
    rating: int
    rank: int


def compute_rating_deltas(entrants: list[RatingEntrant]) -> dict[object, int]:
    """return {user_id: rating_delta} for one finished rated contest; rank is 1-indexed, lower is better, ties draw"""
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
