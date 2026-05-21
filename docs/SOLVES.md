# Solves de avut la indemana

## sir de cifre
```python
def solve(s):
    n = len(s)
    NEG_INF = -1
    dp = [NEG_INF] * 8
    dp[0] = 0

    for c in s:
        d = int(c)
        new_dp = dp[:]
        for mask in range(8):
            if dp[mask] == NEG_INF:
                continue
            new_mask = mask
            r = d % 4
            if r == 0:
                continue
            new_mask |= (1 << (r - 1))
            valid = True
            for rem in range(1, 4):
                if mask & (1 << (rem - 1)):
                    nr = (rem * 2 + d) % 4
                    if nr == 0:
                        valid = False
                        break
                    new_mask |= (1 << (nr - 1))
            if not valid:
                continue
            if new_dp[new_mask] < dp[mask] + 1:
                new_dp[new_mask] = dp[mask] + 1
        dp = new_dp

    return n - max(dp)

t = int(input())
for _ in range(t):
    s = input().strip()
    print(solve(s))
```

## Emoji, sum2

```python
# 😃
a = int(input())
b = int(input())
print(a+b)```

## Diacritice
```python
# explicație
a = int(input())
b = int(input())
print(a+b)
```
