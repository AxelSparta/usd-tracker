import { RiNextjsFill } from 'react-icons/ri'
import { FaGithub } from 'react-icons/fa'
import { FaLinkedin } from 'react-icons/fa'
import { PiSuitcaseSimpleBold } from 'react-icons/pi'

export default function Footer () {
  return (
    <footer className='bg-white rounded-lg shadow-sm m-4 dark:bg-gray-800'>
      <div className='w-full mx-auto max-w-screen-xl p-4 md:flex md:items-center md:justify-between'>
        <span className='text-sm text-gray-500 sm:text-center dark:text-gray-400 flex items-center gap-2'>
          Hecho con{' '}
          <RiNextjsFill className='inline size-5 dark:text-gray-200 text-gray-800' />{' '}
          y con ❤️.
        </span>
        <ul className='flex flex-wrap items-center mt-3 text-sm font-medium text-gray-500 dark:text-gray-400 sm:mt-0'>
          <li>
            <a
              href='https://github.com/axelsparta'
              target='_blank'
              className='me-4 md:me-6 group'
            >
              <FaGithub className='inline size-5 dark:text-gray-200 text-gray-800 group-hover:text-gray-950 dark:group-hover:text-gray-400' />
            </a>
          </li>
          <li>
            <a
              href='https://www.linkedin.com/in/axel-sparta-web/'
              target='_blank'
              className='hover:underline me-4 md:me-6 group'
            >
              <FaLinkedin className='inline size-5 dark:text-gray-200 text-gray-800 group-hover:text-gray-950 dark:group-hover:text-gray-400' />
            </a>
          </li>
          <li>
            <a
              href='https://axelsparta.netlify.app/'
              target='_blank'
              className='hover:underline me-4 md:me-6 group'
            >
              <PiSuitcaseSimpleBold className='inline size-5 dark:text-gray-200 text-gray-800 group-hover:text-gray-950 dark:group-hover:text-gray-400' />
            </a>
          </li>
        </ul>
      </div>
    </footer>
  )
}
