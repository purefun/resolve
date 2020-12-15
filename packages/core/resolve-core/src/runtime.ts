export type Eventstore = {
  saveEvent: (event: any) => Promise<void>
  getNextCursor: Function
  saveSnapshot: Function
  getSecretsManager: () => Promise<SecretsManager>
  loadSnapshot: (snapshotKey: string) => Promise<string | null>
  loadEvents: (param: {
    aggregateIds: string[]
    cursor: null
    limit: number
  }) => Promise<{
    events: any[]
  }>
}

export type SecretsManager = {
  getSecret: (id: string) => Promise<string>
  setSecret: (id: string, secret: string) => Promise<void>
  deleteSecret: (id: string) => Promise<void>
}

export type Monitoring = {
  error: (error: Error, part: string) => Promise<void>
  performanceTracer?: any
}
