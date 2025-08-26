import { ContentSection } from '../components/content-section'
import { AccountForm } from './account-form'

export function SettingsAccount() {
  return (
    <ContentSection
      title='账户设置'
      desc='修改您的登录密码，确保账户安全。'
    >
      <AccountForm />
    </ContentSection>
  )
}
