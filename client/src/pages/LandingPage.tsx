import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, FileText, BarChart3 } from "lucide-react";

export default function LandingPage() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Aplikacioni për Menaxhimin e Klientëve dhe Pagesave
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            Menaxhoni klientët, shërbimet, faturat dhe pagesat tuaja në një vend të vetëm. 
            Ideale për biznese që ofrojnë hosting, email, mbështetje teknike dhe shërbime të tjera.
          </p>
          <Button 
            onClick={handleLogin}
            size="lg"
            className="px-8 py-4 text-lg"
            data-testid="button-login"
          >
            Kyçuni në Aplikacion
          </Button>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <Card className="text-center">
            <CardHeader>
              <Users className="w-12 h-12 mx-auto mb-4 text-blue-600" />
              <CardTitle>Menaxhimi i Klientëve</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Regjistroni dhe menaxhoni informacionet e klientëve tuaj me lehtësi
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Shield className="w-12 h-12 mx-auto mb-4 text-green-600" />
              <CardTitle>Shërbimet</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Krijoni dhe menaxhoni shërbimet tuaja si hosting, email, mbështetje
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <FileText className="w-12 h-12 mx-auto mb-4 text-orange-600" />
              <CardTitle>Faturat</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Krijoni fatura automatike dhe ndiqni statusin e pagesave
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <BarChart3 className="w-12 h-12 mx-auto mb-4 text-purple-600" />
              <CardTitle>Raporte</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Analizoni të ardhurat dhe performancën e biznesit tuaj
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Filloni sot dhe menaxhoni biznesin tuaj më efikasishëm
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            Autentifikohu për të aksesuar të gjitha veçoritë e aplikacionit
          </p>
          <Button 
            onClick={handleLogin}
            size="lg"
            variant="outline"
            className="px-8 py-4 text-lg"
            data-testid="button-login-secondary"
          >
            Kyçuni Tani
          </Button>
        </div>
      </div>
    </div>
  );
}