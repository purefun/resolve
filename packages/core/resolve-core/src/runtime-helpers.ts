import { Monitoring, PerformanceSubsegment } from './runtime'

export const getPerformanceTracerSubsegment = (
  monitoring: Monitoring | undefined,
  name: string
): PerformanceSubsegment => {
  const segment = monitoring?.performanceTracer?.getSegment()
  const subSegment = segment?.addNewSubsegment(name)
  return (
    subSegment ?? {
      addAnnotation: () => {
        /*no-op*/
      },
      addError: () => {
        /*no-op*/
      },
      close: () => {
        /*no-op*/
      },
    }
  )
}
