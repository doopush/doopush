import { Card, CardContent } from '@/components/ui/card'

export function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Terms of Service</h1>
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
                <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  By accessing and using this push notification service ("Service"), you accept and agree to be bound by the terms and provision of this agreement.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Our Service provides push notification management and delivery capabilities for mobile and web applications. We reserve the right to modify, suspend, or discontinue the Service at any time.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">3. User Accounts</h2>
                <p className="text-muted-foreground leading-relaxed">
                  To use our Service, you must create an account. You are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">4. Acceptable Use</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  You agree to use the Service only for lawful purposes and in accordance with these Terms. You may not:
                </p>
                <ul className="space-y-2 text-muted-foreground pl-6">
                  <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                    Send spam, unsolicited, or inappropriate content
                  </li>
                  <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                    Violate any applicable laws or regulations
                  </li>
                  <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                    Interfere with or disrupt the Service or servers
                  </li>
                  <li className="relative before:content-['•'] before:absolute before:-left-4 before:text-foreground">
                    Attempt to gain unauthorized access to any part of the Service
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">5. Privacy Policy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Your privacy is important to us. Please review our Privacy Policy, which also governs your use of the Service, to understand our practices.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">6. Data and Content</h2>
                <p className="text-muted-foreground leading-relaxed">
                  You retain ownership of any content you submit through the Service. However, you grant us a license to use, store, and transmit your content as necessary to provide the Service.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">7. Service Availability</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We strive to maintain high availability of our Service but do not guarantee uninterrupted access. We may temporarily suspend the Service for maintenance or other operational reasons.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">8. Limitation of Liability</h2>
                <p className="text-muted-foreground leading-relaxed">
                  To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">9. Termination</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may terminate or suspend your account and access to the Service immediately, without prior notice, if you breach these Terms of Service.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">10. Changes to Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We reserve the right to modify these Terms at any time. We will notify users of any material changes via email or through the Service.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">11. Governing Law</h2>
                <p className="text-muted-foreground leading-relaxed">
                  These Terms shall be governed and construed in accordance with applicable laws, without regard to conflict of law provisions.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">12. Contact Information</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have any questions about these Terms of Service, please contact us through our support channels.
                </p>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
