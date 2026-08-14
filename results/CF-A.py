import sys

MOD = 1_000_000_007


def solve() -> None:
    data = list(map(int, sys.stdin.buffer.read().split()))
    if not data:
        return

    t = data[0]
    tests = []
    max_c = 0

    for i in range(t):
        n = data[2 * i + 1]
        k = data[2 * i + 2]
        total = k + 1

        if n - 1 >= total.bit_length():
            c = total.bit_count()
        else:
            cap = 1 << (n - 1)
            c = total // cap + (total % cap).bit_count()

        tests.append((n, total, c))
        if c > max_c:
            max_c = c

    limit = 2 * max_c
    fact = [1] * (limit + 1)
    for i in range(1, limit + 1):
        fact[i] = fact[i - 1] * i % MOD

    invfact = [1] * (limit + 1)
    invfact[limit] = pow(fact[limit], MOD - 2, MOD)
    for i in range(limit, 0, -1):
        invfact[i - 1] = invfact[i] * i % MOD

    inv = [0] * (max_c + 1)
    if max_c >= 1:
        inv[1] = 1
    for i in range(2, max_c + 1):
        inv[i] = MOD - (MOD // i) * inv[MOD % i] % MOD

    def catalan(m: int) -> int:
        return fact[2 * m] * invfact[m] % MOD * invfact[m] % MOD * inv[m + 1] % MOD

    ans = []
    for n, total, c in tests:
        ways_order = fact[c]

        if n - 1 >= total.bit_length():
            # The minimal representation is just the binary expansion:
            # every used power appears once.
            pass
        else:
            cap_exp = n - 1
            cap = 1 << cap_exp
            q, rem = divmod(total, cap)

            # q copies of the largest allowed power; lower powers appear
            # at most once in the binary expansion of rem.
            ways_order = ways_order * invfact[q] % MOD

        ans.append(str(catalan(c - 1) * ways_order % MOD))

    sys.stdout.write("\n".join(ans))


if __name__ == "__main__":
    solve()
