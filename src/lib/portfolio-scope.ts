/**
 * Portafolio activo en la nube: `requestJson` lo manda en `PORTFOLIO_HEADER` a `/api/*` y el server
 * filtra por (usuario, portafolio). Vive fuera de los stores para que ningún módulo dependa del
 * de portafolios: lo fija `features/portfolios` antes de cargar los datos.
 */

export const PORTFOLIO_HEADER = 'x-portfolio-id'

let cloudPortfolioId: string | null = null

export const getCloudPortfolioId = () => cloudPortfolioId

export const setCloudPortfolioId = (id: string | null) => {
  cloudPortfolioId = id
}
