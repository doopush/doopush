import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { ChevronDownIcon } from '@radix-ui/react-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { fonts } from '@/config/fonts'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useFont } from '@/context/font-provider'
import { useTheme } from '@/context/theme-provider'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

const appearanceFormSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  font: z.enum(fonts),
})

type AppearanceFormValues = z.infer<typeof appearanceFormSchema>

export function AppearanceForm() {
  const { font, setFont } = useFont()
  const { theme, setTheme } = useTheme()

  // This can come from your database or API.
  const defaultValues: Partial<AppearanceFormValues> = {
    theme: theme as 'light' | 'dark' | 'system',
    font,
  }

  const form = useForm<AppearanceFormValues>({
    resolver: zodResolver(appearanceFormSchema),
    defaultValues,
  })

  function onSubmit(data: AppearanceFormValues) {
    if (data.font != font) setFont(data.font)
    if (data.theme != theme) setTheme(data.theme)

    toast.success('偏好设置已更新')
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
        <FormField
          control={form.control}
          name='font'
          render={({ field }) => (
            <FormItem>
              <FormLabel>字体</FormLabel>
              <div className='relative w-max'>
                <FormControl>
                  <select
                    className={cn(
                      buttonVariants({ variant: 'outline' }),
                      'w-[200px] appearance-none font-normal capitalize',
                      'dark:bg-background dark:hover:bg-background'
                    )}
                    {...field}
                  >
                    {fonts.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <ChevronDownIcon className='absolute end-3 top-2.5 h-4 w-4 opacity-50' />
              </div>
              <FormDescription className='font-manrope'>
                设置您在控制台中使用的字体样式
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='theme'
          render={({ field }) => (
            <FormItem>
              <FormLabel>主题</FormLabel>
              <FormDescription>
                选择控制台的主题样式
              </FormDescription>
              <FormMessage />
              <RadioGroup
                onValueChange={field.onChange}
                defaultValue={field.value}
                className='grid max-w-full grid-cols-3 gap-4 pt-2'
              >
                <FormItem>
                  <FormLabel className='[&:has([data-state=checked])>div]:border-primary flex flex-col cursor-pointer'>
                    <FormControl>
                      <RadioGroupItem value='light' className='sr-only' />
                    </FormControl>
                    <div className='border-muted hover:border-accent items-center rounded-md border-2 p-1'>
                      <div className='space-y-2 rounded-sm bg-[#ecedef] p-2'>
                        <div className='space-y-2 rounded-md bg-white p-2 shadow-xs'>
                          <div className='h-2 w-[80px] rounded-lg bg-[#ecedef]' />
                          <div className='h-2 w-[100px] rounded-lg bg-[#ecedef]' />
                        </div>
                        <div className='flex items-center space-x-2 rounded-md bg-white p-2 shadow-xs'>
                          <div className='h-4 w-4 rounded-full bg-[#ecedef]' />
                          <div className='h-2 w-[100px] rounded-lg bg-[#ecedef]' />
                        </div>
                        <div className='flex items-center space-x-2 rounded-md bg-white p-2 shadow-xs'>
                          <div className='h-4 w-4 rounded-full bg-[#ecedef]' />
                          <div className='h-2 w-[100px] rounded-lg bg-[#ecedef]' />
                        </div>
                      </div>
                    </div>
                    <span className='block w-full p-2 text-center font-normal'>
                      浅色 (Light)
                    </span>
                  </FormLabel>
                </FormItem>
                <FormItem>
                  <FormLabel className='[&:has([data-state=checked])>div]:border-primary flex flex-col cursor-pointer'>
                    <FormControl>
                      <RadioGroupItem value='dark' className='sr-only' />
                    </FormControl>
                    <div className='border-muted bg-popover hover:bg-accent hover:text-accent-foreground items-center rounded-md border-2 p-1'>
                      <div className='space-y-2 rounded-sm bg-slate-950 p-2'>
                        <div className='space-y-2 rounded-md bg-slate-800 p-2 shadow-xs'>
                          <div className='h-2 w-[80px] rounded-lg bg-slate-400' />
                          <div className='h-2 w-[100px] rounded-lg bg-slate-400' />
                        </div>
                        <div className='flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-xs'>
                          <div className='h-4 w-4 rounded-full bg-slate-400' />
                          <div className='h-2 w-[100px] rounded-lg bg-slate-400' />
                        </div>
                        <div className='flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-xs'>
                          <div className='h-4 w-4 rounded-full bg-slate-400' />
                          <div className='h-2 w-[100px] rounded-lg bg-slate-400' />
                        </div>
                      </div>
                    </div>
                    <span className='block w-full p-2 text-center font-normal'>
                      深色 (Dark)
                    </span>
                  </FormLabel>
                </FormItem>
                <FormItem>
                  <FormLabel className='[&:has([data-state=checked])>div]:border-primary flex flex-col cursor-pointer'>
                    <FormControl>
                      <RadioGroupItem value='system' className='sr-only' />
                    </FormControl>
                    <div className='border-muted hover:border-accent items-center rounded-md border-2 p-1'>
                      <div className='space-y-2 rounded-sm bg-gradient-to-r from-[#ecedef] to-slate-950 p-2'>
                        <div className='space-y-2 rounded-md bg-gradient-to-r from-white to-slate-800 p-2 shadow-xs'>
                          <div className='h-2 w-[80px] rounded-lg bg-gradient-to-r from-[#ecedef] to-slate-400' />
                          <div className='h-2 w-[100px] rounded-lg bg-gradient-to-r from-[#ecedef] to-slate-400' />
                        </div>
                        <div className='flex items-center space-x-2 rounded-md bg-gradient-to-r from-white to-slate-800 p-2 shadow-xs'>
                          <div className='h-4 w-4 rounded-full bg-gradient-to-r from-[#ecedef] to-slate-400' />
                          <div className='h-2 w-[100px] rounded-lg bg-gradient-to-r from-[#ecedef] to-slate-400' />
                        </div>
                        <div className='flex items-center space-x-2 rounded-md bg-gradient-to-r from-white to-slate-800 p-2 shadow-xs'>
                          <div className='h-4 w-4 rounded-full bg-gradient-to-r from-[#ecedef] to-slate-400' />
                          <div className='h-2 w-[100px] rounded-lg bg-gradient-to-r from-[#ecedef] to-slate-400' />
                        </div>
                      </div>
                    </div>
                    <span className='block w-full p-2 text-center font-normal'>
                      系统 (System)
                    </span>
                  </FormLabel>
                </FormItem>
              </RadioGroup>
            </FormItem>
          )}
        />

        <Button type='submit'>更新偏好设置</Button>
      </form>
    </Form>
  )
}
