export function SelectDolar () {
  return (
    <select className='border rounded px-2 py-1 cursor-pointer border-gray-300 dark:text-gray-900'>
      <option value='oficial'>Dolar Oficial</option>
      <option value='blue'>Dolar Blue</option>
      <option value='bolsa'>Dolar Bolsa</option>
      <option value='contadoconliqui'>Dolar CCL</option>
      <option value='tarjeta'>Dolar Tarjeta</option>
      <option value='mayorista'>Dolar Mayorista</option>
      <option value='cripto'>Dolar Cripto</option>
    </select>
  )
}
