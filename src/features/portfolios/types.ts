/** Portafolio: sus cuatro módulos tienen saldos, validaciones y métricas propios */
export type Portfolio = {
  /** UUID en la nube; en local, `LOCAL_DEFAULT_PORTFOLIO_ID` para el que ya existía */
  id: string
  name: string
}
