import React, { useState } from 'react'
import { useReduxReadModel } from 'resolve-redux'

const lockedHooks = []
const freeHooks = []

const HooksDependencies = ({
  match: {
    params: { userId },
  },
}) => {
  const [pass, setPass] = useState(1)

  const { request: lockedHook } = useReduxReadModel(
    {
      name: 'users',
      resolver: 'profile',
      args: {
        userId,
      },
    },
    {},
    [setPass]
  )
  const { request: freeHook } = useReduxReadModel(
    {
      name: 'users',
      resolver: 'profile',
      args: {
        userId,
      },
    },
    {}
  )
  if (!lockedHooks.includes(lockedHook)) {
    lockedHooks.push(lockedHook)
  }
  if (!freeHooks.includes(freeHook)) {
    freeHooks.push(freeHook)
  }
  const incrementPass = () => setPass(pass + 1)

  return (
    <div>
      <button onClick={incrementPass}>next pass</button>
      <div>{`pass: ${pass}`}</div>
      <div>{`locked hooks count: ${lockedHooks.length}`}</div>
      <div>{`free hooks count: ${freeHooks.length}`}</div>
    </div>
  )
}

export { HooksDependencies }
