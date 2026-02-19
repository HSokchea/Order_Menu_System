import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Loader2, Store, DollarSign, Receipt, Settings2, AlertTriangle, Upload, X, ImageIcon, Camera, Download, Trash2 } from 'lucide-react';
import { GeoRestrictionSettings, GeoSettings } from '@/components/admin/GeoRestrictionSettings';
import Cropper from 'react-easy-crop';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface RestaurantSettings {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  logo_url: string | null;
  currency: string;
  default_tax_percentage: number;
  service_charge_percentage: number;
  exchange_rate_usd_to_khr: number;
  vat_tin: string | null;
  default_order_type: string;
  receipt_header_text: string | null;
  receipt_footer_text: string | null;
  show_tax_on_receipt: boolean;
  show_service_charge_on_receipt: boolean;
  allow_multiple_orders_per_table: boolean;
  auto_close_session_after_payment: boolean;
  geo_latitude: number | null;
  geo_longitude: number | null;
  geo_radius_meters: number;
}

const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'KHR', label: 'KHR - Cambodian Riel' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'THB', label: 'THB - Thai Baht' },
  { value: 'VND', label: 'VND - Vietnamese Dong' },
  { value: 'SGD', label: 'SGD - Singapore Dollar' },
  { value: 'MYR', label: 'MYR - Malaysian Ringgit' },
];

export default function Settings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasActiveSessions, setHasActiveSessions] = useState(false);
  const [pendingCurrencyChange, setPendingCurrencyChange] = useState<string | null>(null);
  const [originalCurrency, setOriginalCurrency] = useState<string>('USD');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null); // base64 or url
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    fetchSettings();
    checkActiveSessions();
  }, [user]);

  useEffect(() => {
    if (cameraDialogOpen && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraDialogOpen, cameraStream]);

  const fetchSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select(`
          id,
          name,
          phone,
          address,
          city,
          country,
          logo_url,
          currency,
          default_tax_percentage,
          service_charge_percentage,
          exchange_rate_usd_to_khr,
          vat_tin,
          default_order_type,
          receipt_header_text,
          receipt_footer_text,
          show_tax_on_receipt,
          show_service_charge_on_receipt,
          allow_multiple_orders_per_table,
          auto_close_session_after_payment,
          geo_latitude,
          geo_longitude,
          geo_radius_meters
        `)
        .eq('owner_id', user.id)
        .single();

      if (error) throw error;

      // Cast to any to handle new columns not yet in types
      const restaurant = data as any;

      setSettings({
        id: restaurant.id,
        name: restaurant.name,
        phone: restaurant.phone,
        address: restaurant.address,
        city: restaurant.city,
        country: restaurant.country,
        logo_url: restaurant.logo_url,
        currency: restaurant.currency || 'USD',
        default_tax_percentage: Number(restaurant.default_tax_percentage) || 0,
        service_charge_percentage: Number(restaurant.service_charge_percentage) || 0,
        exchange_rate_usd_to_khr: Number(restaurant.exchange_rate_usd_to_khr) || 4100,
        vat_tin: restaurant.vat_tin,
        default_order_type: restaurant.default_order_type || 'dine_in',
        receipt_header_text: restaurant.receipt_header_text,
        receipt_footer_text: restaurant.receipt_footer_text ?? 'Thank you for dining with us!',
        show_tax_on_receipt: restaurant.show_tax_on_receipt ?? true,
        show_service_charge_on_receipt: restaurant.show_service_charge_on_receipt ?? true,
        allow_multiple_orders_per_table: restaurant.allow_multiple_orders_per_table ?? true,
        auto_close_session_after_payment: restaurant.auto_close_session_after_payment ?? true,
        geo_latitude: restaurant.geo_latitude ? Number(restaurant.geo_latitude) : null,
        geo_longitude: restaurant.geo_longitude ? Number(restaurant.geo_longitude) : null,
        geo_radius_meters: Number(restaurant.geo_radius_meters) || 100,
      });
      setOriginalCurrency(restaurant.currency || 'USD');
    } catch (err: any) {
      console.error('Error fetching settings:', err);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const checkActiveSessions = async () => {
    if (!user) return;

    try {
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (!restaurant) return;

      const { count } = await supabase
        .from('table_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurant.id)
        .eq('status', 'open');

      setHasActiveSessions((count ?? 0) > 0);
    } catch (err) {
      console.error('Error checking active sessions:', err);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    console.log('Settings update:', settings);
    setSaving(true);
    try {
      // Validate geo settings
      if (settings.geo_latitude === null || settings.geo_longitude === null) {
        toast.error('Please set your shop location on the map before saving');
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('restaurants')
        .update({
          name: settings.name,
          phone: settings.phone,
          address: settings.address,
          city: settings.city,
          country: settings.country,
          logo_url: settings.logo_url,
          currency: settings.currency,
          default_tax_percentage: settings.default_tax_percentage,
          service_charge_percentage: settings.service_charge_percentage,
          exchange_rate_usd_to_khr: settings.exchange_rate_usd_to_khr,
          vat_tin: settings.vat_tin,
          default_order_type: settings.default_order_type,
          receipt_header_text: settings.receipt_header_text,
          receipt_footer_text: settings.receipt_footer_text,
          show_tax_on_receipt: settings.show_tax_on_receipt,
          show_service_charge_on_receipt: settings.show_service_charge_on_receipt,
          allow_multiple_orders_per_table: settings.allow_multiple_orders_per_table,
          auto_close_session_after_payment: settings.auto_close_session_after_payment,
          geo_latitude: settings.geo_latitude,
          geo_longitude: settings.geo_longitude,
          geo_radius_meters: settings.geo_radius_meters,
        } as any)
        .eq('id', settings.id);
      if (error) throw error;

      setOriginalCurrency(settings.currency);
      setPendingCurrencyChange(null);
      toast.success('Settings saved successfully');
    } catch (err: any) {
      console.error('Error saving settings:', err);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCurrencyChange = (value: string) => {
    if (value !== originalCurrency) {
      setPendingCurrencyChange(value);
    } else {
      setPendingCurrencyChange(null);
      setSettings(prev => prev ? { ...prev, currency: value } : null);
    }
  };

  const confirmCurrencyChange = () => {
    if (pendingCurrencyChange) {
      setSettings(prev => prev ? { ...prev, currency: pendingCurrencyChange } : null);
      setPendingCurrencyChange(null);
    }
  };

  const cancelCurrencyChange = () => {
    setPendingCurrencyChange(null);
  };

  const handleLogoUpload = async (file: File) => {
    if (!settings) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${settings.id}/logo_${Date.now()}.${fileExt}`;

    setUploading(true);

    try {
      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('menu-images')
        .getPublicUrl(fileName);

      setSettings({ ...settings, logo_url: data.publicUrl });
      toast.success('Logo uploaded successfully');
    } catch (error: any) {
      toast.error('Failed to upload logo: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleLogoUpload(file);
    }
  };

  const handleRemoveLogo = async () => {
    if (!settings) return;
    // Delete from storage if it's a Supabase URL
    if (settings.logo_url) {
      try {
        const url = settings.logo_url;
        const bucketPath = url.split('/menu-images/')[1];
        if (bucketPath) {
          await supabase.storage.from('menu-images').remove([decodeURIComponent(bucketPath)]);
        }
      } catch (err) {
        console.error('Failed to delete logo from storage:', err);
      }
    }
    setSettings(prev => prev ? { ...prev, logo_url: null } : null);
    setPreviewDialogOpen(false);
    setConfirmDeleteOpen(false);
    toast.success('Logo removed');
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraDialogOpen(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    stopCamera();
    setSelectedImage(dataUrl);
    setCropDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Utility to crop image
  async function getCroppedImg(imageSrc: string, crop: any): Promise<string> {
    const image = new window.Image();
    image.src = imageSrc;
    await new Promise(resolve => { image.onload = resolve; });
    const canvas = document.createElement('canvas');
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(
      image,
      crop.x, crop.y, crop.width, crop.height,
      0, 0, crop.width, crop.height
    );
    return canvas.toDataURL('image/png');
  }
  function dataURLtoFile(dataurl: string, filename: string) {
    const arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)![1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
    return new File([u8arr], filename, { type: mime });
  }

  if (!settings) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Failed to load settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {hasActiveSessions && (
        <Alert variant="destructive" className="bg-orange-50 border-orange-200">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            You have active table sessions. Some settings (like currency) cannot be changed until all sessions are closed.
          </AlertDescription>
        </Alert>
      )}

      {/* Shop Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" />
            <CardTitle className='text-lg font-medium'>Shop Profile</CardTitle>
          </div>
          <CardDescription>Basic information about your restaurant</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logo */}
          <div className="space-y-2">
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="relative group">
                  {/* Profile Image or Placeholder */}
                  <div
                    className="rounded-full border-2 border-dashed border-border overflow-hidden cursor-pointer"
                    style={{ width: 192, height: 192 }}
                    onClick={() => settings.logo_url && setPreviewDialogOpen(true)}
                  >
                    {settings.logo_url ? (
                      <img
                        src={settings.logo_url}
                        alt="Logo"
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-muted/20">
                        <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">No logo</span>
                      </div>
                    )}
                  </div>
                  {/* Camera Icon Overlay */}
                  <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="absolute bottom-2 right-2 bg-white rounded-full p-2 shadow group-hover:scale-110 transition"
                        onClick={e => { e.stopPropagation(); setPopoverOpen(true); }}
                      >
                        <Camera className="h-5 w-5 text-primary" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-full p-2">
                      <button
                        className="text-sm font-regular flex items-center gap-2 w-full px-2 py-1 hover:bg-muted rounded"
                        onClick={() => {
                          setPopoverOpen(false);
                          fileInputRef.current?.click();
                        }}
                      >
                        <ImageIcon className="h-4 w-4" /> Upload from file
                      </button>
                      <button
                        className="text-sm font-regular flex items-center gap-2 w-full px-2 py-1 hover:bg-muted rounded"
                        onClick={async () => {
                          setPopoverOpen(false);
                          try {
                            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                            setCameraStream(stream);
                            setCameraDialogOpen(true);
                          } catch (err) {
                            toast.error('Could not access camera. Please check permissions.');
                          }
                        }}
                      >
                        <Camera className="h-4 w-4" /> Take a photo
                      </button>
                    </PopoverContent>
                  </Popover>

                  <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
                    <DialogContent className="max-w-xs">
                      <div className="relative w-64 h-64 bg-black">
                        {selectedImage && (
                          <Cropper
                            image={selectedImage}
                            crop={crop}
                            zoom={zoom}
                            aspect={1}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={(_, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels)}
                          />
                        )}
                      </div>
                      <div className="flex justify-end gap-2 mt-2">
                        <Button variant="outline" size="sm" onClick={() => setCropDialogOpen(false)}>Cancel</Button>
                        <Button
                          size="sm"
                          onClick={async () => {
                            // Crop the image and upload
                            if (selectedImage && croppedAreaPixels) {
                              const cropped = await getCroppedImg(selectedImage, croppedAreaPixels);
                              // Call your upload handler here
                              handleLogoUpload(dataURLtoFile(cropped, 'logo.png'));
                              setCropDialogOpen(false);
                            }
                          }}
                        >Save</Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
                    <DialogContent
                      className="p-0 bg-black/90 shadow-none border-none flex items-center justify-center"
                      style={{
                        maxWidth: '100vw',
                        maxHeight: '100vh',
                        width: '100vw',
                        height: '100vh',
                        background: 'rgba(0,0,0,0.92)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Button
                        className="absolute top-6 right-6 z-20 bg-black/60 hover:bg-black/20 rounded-full"
                        onClick={() => setPreviewDialogOpen(false)}
                        variant="custom"
                      >
                        <X className="h-8 w-8 text-white" />
                      </Button>
                      <div className="relative flex items-center justify-center w-full h-full">
                        <img
                          src={settings.logo_url!}
                          alt="Logo Preview"
                          className="max-w-[90vw] max-h-[80vh] rounded-lg object-contain shadow-lg"
                          style={{ background: 'white' }}
                        />
                        <div className="absolute top-6 right-20 flex gap-3 z-20">
                          <Button
                            variant="custom"
                            size="icon"
                            className="bg-black/60 hover:bg-black/80 text-white"
                            onClick={async () => {
                              if (!settings.logo_url) return;
                              try {
                                // Get file extension from URL or default to png
                                const url = settings.logo_url;
                                const extMatch = url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i);
                                const ext = extMatch ? extMatch[1] : 'png';
                                const filename = `logo.${ext}`;

                                // Fetch as blob for best compatibility
                                const response = await fetch(url, { mode: 'cors' });
                                const blob = await response.blob();
                                const blobUrl = window.URL.createObjectURL(blob);

                                const link = document.createElement('a');
                                link.href = blobUrl;
                                link.download = filename;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                window.URL.revokeObjectURL(blobUrl);
                              } catch (err) {
                                toast.error('Failed to download image');
                              }
                            }}
                          >
                            <Download className="h-8 w-8" />
                          </Button>
                          <Button
                            variant="custom"
                            size="icon"
                            className="bg-black/60 hover:bg-black/80 text-white"
                            onClick={() => setConfirmDeleteOpen(true)}
                          >
                            <Trash2 className="h-8 w-8" />
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <ConfirmDialog
                    open={confirmDeleteOpen}
                    onOpenChange={setConfirmDeleteOpen}
                    title="Remove Logo"
                    description="Are you sure you want to remove the logo?"
                    confirmLabel="Remove"
                    variant="destructive"
                    onConfirm={handleRemoveLogo}
                  />

                  {/* Camera Dialog */}
                  <Dialog open={cameraDialogOpen} onOpenChange={(open) => { if (!open) stopCamera(); }}>
                    <DialogContent className="max-w-sm">
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-foreground">Take a Photo</h3>
                        <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={stopCamera}>Cancel</Button>
                          <Button size="sm" onClick={capturePhoto}>
                            <Camera className="h-4 w-4 mr-2" />
                            Capture
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = ev => {
                          setSelectedImage(ev.target?.result as string);
                          setCropDialogOpen(true);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Restaurant Name *</Label>
              <Input
                id="name"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                placeholder="Enter restaurant name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={settings.phone || ''}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                placeholder="+855 12 345 678"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={settings.address || ''}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              placeholder="Street address"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={settings.city || ''}
                onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                placeholder="City"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={settings.country || ''}
                onChange={(e) => setSettings({ ...settings, country: e.target.value })}
                placeholder="Country"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <CardTitle className='text-lg font-medium'>Financial Settings</CardTitle>
          </div>
          <CardDescription>
            Currency display and tax configuration. All monetary data is stored in base currency (USD).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currency">Display Currency</Label>
            <Select
              value={pendingCurrencyChange || settings.currency}
              onValueChange={handleCurrencyChange}
              disabled={hasActiveSessions}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select display currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((curr) => (
                  <SelectItem key={curr.value} value={curr.value}>
                    {curr.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Affects receipts, bills, and reports display only. Does not modify stored data.
            </p>
            {hasActiveSessions && (
              <p className="text-xs text-amber-600">
                Close all active sessions to change display currency
              </p>
            )}
          </div>

          {pendingCurrencyChange && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <p className="font-medium mb-2">Changing Display Currency</p>
                <p className="text-sm mb-3">
                  This only affects how prices are <strong>displayed</strong> on new receipts and reports.
                  All monetary data remains stored in base currency (USD). Existing paid orders are not affected.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={confirmCurrencyChange}>
                    Confirm Change
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelCurrencyChange}>
                    Cancel
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tax">Tax Percentage (%)</Label>
              <Input
                id="tax"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings.default_tax_percentage}
                onChange={(e) => setSettings({ ...settings, default_tax_percentage: parseFloat(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service">Service Charge (%)</Label>
              <Input
                id="service"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings.service_charge_percentage}
                onChange={(e) => setSettings({ ...settings, service_charge_percentage: parseFloat(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
          </div>

          {/* Exchange Rate Section */}
          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="exchange_rate">
              <span className="block">Current Exchange Rate (USD → KHR)</span>
              <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                អត្រាប្តូរប្រាក់បច្ចុប្បន្ន (ដុល្លារ → រៀល)
              </span>
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">1 USD =</span>
              <Input
                id="exchange_rate"
                type="number"
                min="1"
                max="10000"
                step="1"
                value={settings.exchange_rate_usd_to_khr}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  if (value >= 0 && value <= 10000) {
                    setSettings({ ...settings, exchange_rate_usd_to_khr: value });
                  }
                }}
                className="w-32"
                placeholder="4100"
              />
              <span className="text-sm text-muted-foreground">KHR</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Used for KHR conversion on active/unpaid orders. Paid orders use the rate frozen at payment time.
            </p>
            <p className="text-xs text-amber-600">
              ⚠️ Changing this rate does NOT affect past completed orders.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vat_tin">VAT TIN (Optional)</Label>
              <Input
                id="vat_tin"
                value={settings.vat_tin || ''}
                onChange={(e) => setSettings({ ...settings, vat_tin: e.target.value || null })}
                placeholder="e.g., K001-12345678"
              />
              <p className="text-xs text-muted-foreground">
                Displayed on receipts if provided
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="default_order_type">Default Order Type</Label>
              <Select
                value={settings.default_order_type}
                onValueChange={(value) => setSettings({ ...settings, default_order_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select order type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dine_in">Dine In</SelectItem>
                  <SelectItem value="takeaway">Takeaway</SelectItem>
                  <SelectItem value="delivery">Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receipt Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            <CardTitle className='text-lg font-medium'>Receipt Settings</CardTitle>
          </div>
          <CardDescription>Customize how receipts appear to customers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="header">Receipt Header Text</Label>
            <Input
              id="header"
              value={settings.receipt_header_text || ''}
              onChange={(e) => setSettings({ ...settings, receipt_header_text: e.target.value })}
              placeholder="Optional header message (e.g., Welcome!)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="footer">Receipt Footer Message</Label>
            <Textarea
              id="footer"
              value={settings.receipt_footer_text || ''}
              onChange={(e) => setSettings({ ...settings, receipt_footer_text: e.target.value })}
              placeholder="Thank you for dining with us!"
              rows={2}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Tax on Receipt</Label>
                <p className="text-sm text-muted-foreground">
                  Display tax breakdown on customer receipts
                </p>
              </div>
              <Switch
                checked={settings.show_tax_on_receipt}
                onCheckedChange={(checked) => setSettings({ ...settings, show_tax_on_receipt: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Service Charge on Receipt</Label>
                <p className="text-sm text-muted-foreground">
                  Display service charge breakdown on customer receipts
                </p>
              </div>
              <Switch
                checked={settings.show_service_charge_on_receipt}
                onCheckedChange={(checked) => setSettings({ ...settings, show_service_charge_on_receipt: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Operation Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            <CardTitle className='text-lg font-medium'>Operation Settings</CardTitle>
          </div>
          <CardDescription>Configure how your restaurant operates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Allow Multiple Orders Per Table</Label>
              <p className="text-sm text-muted-foreground">
                Customers can place multiple orders in a single session
              </p>
            </div>
            <Switch
              checked={settings.allow_multiple_orders_per_table}
              onCheckedChange={(checked) => setSettings({ ...settings, allow_multiple_orders_per_table: checked })}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-close Session After Payment</Label>
              <p className="text-sm text-muted-foreground">
                Automatically close table session when payment is completed
              </p>
            </div>
            <Switch
              checked={settings.auto_close_session_after_payment}
              onCheckedChange={(checked) => setSettings({ ...settings, auto_close_session_after_payment: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Shop Location Settings (Mandatory) */}
      <GeoRestrictionSettings
        settings={{
          geo_latitude: settings.geo_latitude,
          geo_longitude: settings.geo_longitude,
          geo_radius_meters: settings.geo_radius_meters,
        }}
        onChange={(geo) => setSettings({ ...settings, ...geo })}
      />

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
