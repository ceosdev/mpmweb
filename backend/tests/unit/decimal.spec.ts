import { test } from '@japa/runner'
import {
  divRoundHalfUp,
  fromScaled,
  lineGrossCents,
  toScaled,
  unitCostFromLine,
  weightedAverageCost,
} from '#utils/decimal'

test.group('utils/decimal | scale', () => {
  test('toScaled converts strings and numbers to scaled bigint', ({ assert }) => {
    assert.equal(toScaled('2.53', 4), 25300n)
    assert.equal(toScaled('3.4567000000', 10), 34567000000n)
    assert.equal(toScaled(3, 4), 30000n)
    assert.equal(toScaled('-1.5', 2), -150n)
  })

  test('fromScaled renders fixed scale', ({ assert }) => {
    assert.equal(fromScaled(25300n, 4), '2.5300')
    assert.equal(fromScaled(-5n, 4), '-0.0005')
    assert.equal(fromScaled(7n, 0), '7')
  })

  test('toScaled rejects invalid formats', ({ assert }) => {
    for (const bad of ['abc', '', '1e5', '1,5']) {
      assert.throws(() => toScaled(bad, 4))
    }
  })
})

test.group('utils/decimal | half-up', () => {
  test('divRoundHalfUp rounds half away from zero', ({ assert }) => {
    assert.equal(divRoundHalfUp(5n, 2n), 3n)
    assert.equal(divRoundHalfUp(-5n, 2n), -3n)
    assert.equal(divRoundHalfUp(4n, 2n), 2n)
  })

  test('lineGrossCents rounds quantity x price to cents', ({ assert }) => {
    assert.equal(lineGrossCents('2.53', '3.4567'), 875n)
    assert.equal(lineGrossCents('0.8334', '43.2'), 3600n)
  })

  test('division by zero throws', ({ assert }) => {
    assert.throws(() => divRoundHalfUp(1n, 0n))
  })
})

test.group('utils/decimal | costs', () => {
  test('unitCostFromLine divides net line by quantity', ({ assert }) => {
    assert.equal(unitCostFromLine(3500n, '10'), '3.5000000000')
  })

  test('weightedAverageCost: basic, legacy null and negative stock', ({ assert }) => {
    assert.equal(
      weightedAverageCost({ stock: '10', cost: '3', quantity: '10', lineNetCents: 4000n }),
      '3.5000000000'
    )
    assert.equal(
      weightedAverageCost({ stock: null, cost: null, quantity: '5', lineNetCents: 1000n }),
      '2.0000000000'
    )
    assert.equal(
      weightedAverageCost({ stock: '-2', cost: '9', quantity: '4', lineNetCents: 800n }),
      '2.0000000000'
    )
  })

  test('chain 10@3 -> +10@4 -> +20@5 gives 4.25', ({ assert }) => {
    const second = weightedAverageCost({ stock: '10', cost: '3', quantity: '10', lineNetCents: 4000n })
    const third = weightedAverageCost({ stock: '20.0000', cost: second, quantity: '20', lineNetCents: 10000n })
    assert.equal(third, '4.2500000000')
  })
})
