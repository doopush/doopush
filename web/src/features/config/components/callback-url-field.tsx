import type { Control, FieldValues, Path } from 'react-hook-form'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

interface CallbackUrlFieldProps<T extends FieldValues> {
  control: Control<T>
  name: Path<T>
  label?: string
  placeholder?: string
  description?: string
}

/**
 * 推送回执 URL 输入框：在多个厂商配置区块复用，避免 12 处重复 JSX。
 */
export function CallbackUrlField<T extends FieldValues>({
  control,
  name,
  label = '消息回执',
  placeholder = '输入推送消息回执（可选）',
  description = '推送状态回调地址，用于接收推送结果通知',
}: CallbackUrlFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input placeholder={placeholder} {...field} />
          </FormControl>
          <FormDescription>{description}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
