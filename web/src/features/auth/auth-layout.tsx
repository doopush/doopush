import { Package } from "lucide-react"

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className='container grid grid-cols-1 h-svh max-w-none items-center justify-center'>
      <div className='mx-auto flex w-full flex-col justify-center space-y-2 py-8 sm:w-[480px] sm:p-8'>
        <div className='mb-8 flex flex-col items-center gap-4'>
          <Package className='size-16' />
          <h1 className='text-xl font-medium'>DooPush</h1>
        </div>
        {children}
      </div>
    </div>
  )
}
