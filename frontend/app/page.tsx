import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-r from-sky-100 to-indigo-100">
      <h1 className="text-4xl font-bold text-indigo-700 mb-6">Welcome to Chat Groups</h1>
      <div className="space-x-4">
        <Link href="/login" className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
          Login
        </Link>
        <Link href="/register" className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">
          Register
        </Link>
      </div>
    </div>
  )
}
