import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, Copy, ExternalLink, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { QRTableCard } from '@/components/admin/QRTableCard';
import { downloadQRCard, type PaperSize } from '@/lib/qrCardDownloader';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileImage, FileText } from 'lucide-react';

interface RestaurantData {
  id: string;
  name: string;
  logo_url: string | null;
}

const QRGenerator = () => {
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState<RestaurantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);

  // Two refs: one for preview, one for printing
  const previewCardRef = useRef<HTMLDivElement>(null);
  const printCardRef = useRef<HTMLDivElement>(null);

  const menuUrl = restaurant ? `${window.location.origin}/menu/${restaurant.id}` : '';

  const fetchData = async () => {
    if (!user) return;

    const { data: restaurantData } = await supabase
      .from('restaurants')
      .select('id, name, logo_url')
      .eq('owner_id', user.id)
      .single();

    if (restaurantData) {
      setRestaurant(restaurantData);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Generate QR code when restaurant is loaded
  useEffect(() => {
    if (restaurant?.id) {
      generateQRCode();
    }
  }, [restaurant?.id]);

  const generateQRCode = async () => {
    if (!restaurant) return;

    try {
      const url = `${window.location.origin}/menu/${restaurant.id}`;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'H',
      });
      setQrCodeDataUrl(dataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Failed to generate QR code');
    }
  };

  const copyMenuUrl = async () => {
    try {
      await navigator.clipboard.writeText(menuUrl);
      toast.success('Menu URL copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy URL');
    }
  };

  const openMenuUrl = () => {
    window.open(menuUrl, '_blank');
  };

  const handleDownload = async (format: 'png' | 'pdf', paperSize?: PaperSize) => {
    if (!printCardRef.current || !restaurant) return;

    setIsDownloading(true);
    try {
      const result = await downloadQRCard(printCardRef.current, {
        format,
        paperSize,
        tableNumber: 'Shop',
        restaurantName: restaurant.name,
      });

      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to download QR card');
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!restaurant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No restaurant found. Please complete onboarding first.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold">Shop QR Code</h2>
              <p className="text-sm text-muted-foreground">
                One static QR code for your shop - customers scan to access your menu
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* QR Card Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            {restaurant.name} Menu QR
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* QR Card Preview */}
          <div className="flex flex-col items-center">
            <div className="overflow-hidden rounded-2xl shadow-lg border">
              <QRTableCard
                ref={previewCardRef}
                restaurantName={restaurant.name}
                tableNumber=""
                qrCodeDataUrl={qrCodeDataUrl}
                logoUrl={restaurant.logo_url}
                isPrintMode={false}
              />
            </div>

            {/* Hidden Card for Print/Download */}
            <div className="absolute opacity-0 pointer-events-none" style={{ left: '-9999px' }}>
              <QRTableCard
                ref={printCardRef}
                restaurantName={restaurant.name}
                tableNumber=""
                qrCodeDataUrl={qrCodeDataUrl}
                logoUrl={restaurant.logo_url}
                isPrintMode={true}
              />
            </div>
          </div>

          {/* Menu URL */}
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm font-medium mb-2">Menu URL</p>
            <code className="text-xs bg-background px-2 py-1 rounded border block overflow-x-auto">
              {menuUrl}
            </code>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-center">
            <Button variant="outline" onClick={copyMenuUrl}>
              <Copy className="h-4 w-4 mr-2" />
              Copy URL
            </Button>

            <Button variant="outline" onClick={openMenuUrl}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Preview Menu
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={isDownloading || !qrCodeDataUrl}>
                  <Download className="h-4 w-4 mr-2" />
                  Download QR Card
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Download Format</DropdownMenuLabel>
                <DropdownMenuItem
                  disabled={isDownloading || !qrCodeDataUrl}
                  onClick={() => handleDownload('png')}
                >
                  <FileImage className="h-4 w-4 mr-2" />
                  PNG Image
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>PDF (Print-Ready)</DropdownMenuLabel>
                <DropdownMenuItem
                  disabled={isDownloading || !qrCodeDataUrl}
                  onClick={() => handleDownload('pdf', 'A6')}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  A6 (Table Stand)
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isDownloading || !qrCodeDataUrl}
                  onClick={() => handleDownload('pdf', 'A5')}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  A5 (Flat Card)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            This QR code is permanent and reusable. Print it once and place it in your shop.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default QRGenerator;