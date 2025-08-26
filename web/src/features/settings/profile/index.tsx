import { ContentSection } from '../components/content-section'
import { ProfileForm } from './profile-form'

export function SettingsProfile() {
  return (
    <ContentSection
      title='个人资料'
      desc='管理您的个人信息和在系统中显示的内容。'
    >
      <ProfileForm />
    </ContentSection>
  )
}
