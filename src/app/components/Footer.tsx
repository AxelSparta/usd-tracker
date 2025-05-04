export default function Footer () {
  return (
    <footer className='bg-white rounded-lg shadow-sm m-4 dark:bg-gray-800'>
      <div className='w-full mx-auto max-w-screen-xl p-4 md:flex md:items-center md:justify-between'>
        <span className='text-sm text-gray-500 sm:text-center dark:text-gray-400'>
          Hecho con Next.js y con ❤️.
        </span>
        <ul className='flex flex-wrap items-center mt-3 text-sm font-medium text-gray-500 dark:text-gray-400 sm:mt-0'>
          <li>
            <a href='https://github.com/axelsparta' target='_blank' className='hover:underline me-4 md:me-6'>
              Github 
            </a>
          </li>
          <li>
            <a href='https://www.linkedin.com/in/axel-sparta-web/' target='_blank' className='hover:underline me-4 md:me-6'>
              Linkedin
            </a>
          </li>
          <li>
            <a href='https://axelsparta.netlify.app/' target='_blank' className='hover:underline me-4 md:me-6'>
              Portfolio
            </a>
          </li>
        </ul>
      </div>
    </footer>
  )
}
