import { Card, CardContent } from '@/components/ui/card'

export function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
          <p className="text-muted-foreground mt-2">
            Last updated: {new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        <Card className="py-0">
          <CardContent className="p-8 space-y-6">
            <div className="space-y-6">
              <section>
                <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We collect information you provide directly to us, such as when you create an account, configure push notifications, or contact us for support.
                </p>
                
                <div className="pl-4 space-y-4">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Personal Information</h3>
                    <ul className="space-y-2 text-muted-foreground pl-6">
                      <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                        Email address and username
                      </li>
                      <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                        Profile information (name, avatar)
                      </li>
                      <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                        Account preferences and settings
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-2">Application Data</h3>
                    <ul className="space-y-2 text-muted-foreground pl-6">
                      <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                        Application configurations and settings
                      </li>
                      <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                        Push notification content and metadata
                      </li>
                      <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                        Device tokens and registration information
                      </li>
                      <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                        Usage analytics and service logs
                      </li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We use the information we collect to:
                </p>
                <ul className="space-y-2 text-muted-foreground pl-6">
                  <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                    Provide, maintain, and improve our Service
                  </li>
                  <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                    Process and deliver push notifications
                  </li>
                  <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                    Send you technical notices and support messages
                  </li>
                  <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                    Monitor and analyze usage patterns
                  </li>
                  <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                    Detect and prevent fraud or abuse
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">3. Information Sharing</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We do not sell, trade, or otherwise transfer your personal information to third parties, except as described in this policy:
                </p>
                <ul className="space-y-2 text-muted-foreground pl-6">
                  <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                    With your consent
                  </li>
                  <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                    To comply with legal obligations
                  </li>
                  <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                    To protect our rights and prevent fraud
                  </li>
                  <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                    In connection with a business transfer
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">4. Data Security</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We retain your information for as long as necessary to provide our services and fulfill the purposes outlined in this policy, unless a longer retention period is required by law.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">6. Third-Party Services</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Our Service may integrate with third-party push notification providers (such as FCM, APNs, and various vendor SDKs). These services have their own privacy policies governing their use of your information.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">7. International Data Transfers</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place for such transfers.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">8. Your Rights</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Depending on your location, you may have certain rights regarding your personal information, including:
                </p>
                <ul className="space-y-2 text-muted-foreground pl-6">
                  <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                    Access to your personal information
                  </li>
                  <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                    Correction of inaccurate information
                  </li>
                  <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                    Deletion of your information
                  </li>
                  <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                    Portability of your data
                  </li>
                  <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                    Objection to processing
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">9. Cookies and Tracking</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We use cookies and similar tracking technologies to collect information about your browsing activities and to personalize your experience.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">10. Children's Privacy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Our Service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">11. Changes to This Policy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">12. Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have any questions about this Privacy Policy or our data practices, please contact us through our support channels.
                </p>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
