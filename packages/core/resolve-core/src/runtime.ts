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
  performanceTracer?: PerformanceTracer
}

export type PerformanceSubsegment = {
  addAnnotation: (name: string, data: any) => void
  addError: (error: Error) => void
  close: () => void
}
export type PerformanceSegment = {
  addNewSubsegment: (name: string) => PerformanceSubsegment
}

export type PerformanceTracer = {
  getSegment: () => PerformanceSegment
}

export type ReadModelConnector = {
  connect: (readModelName: string) => Promise<any>
  disconnect: (readModelName: string, connection: any) => Promise<void>
}
