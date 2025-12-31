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
import { Loader2, Store, DollarSign, Receipt, Settings2, AlertTriangle, Upload, X, ImageIcon } from 'lucide-react';

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
  receipt_header_text: string | null;
  receipt_footer_text: string | null;
  show_tax_on_receipt: boolean;
  show_service_charge_on_receipt: boolean;
  allow_multiple_orders_per_table: boolean;
  auto_close_session_after_payment: boolean;
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

  useEffect(() => {
    fetchSettings();
    checkActiveSessions();
  }, [user]);

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
          receipt_header_text,
          receipt_footer_text,
          show_tax_on_receipt,
          show_service_charge_on_receipt,
          allow_multiple_orders_per_table,
          auto_close_session_after_payment
        `)
        .eq('owner_id', user.id)
        .single();

      if (error) throw error;

      setSettings({
        id: data.id,
        name: data.name,
        phone: data.phone,
        address: data.address,
        city: data.city,
        country: data.country,
        logo_url: data.logo_url,
        currency: data.currency || 'USD',
        default_tax_percentage: Number(data.default_tax_percentage) || 0,
        service_charge_percentage: Number(data.service_charge_percentage) || 0,
        receipt_header_text: data.receipt_header_text,
        receipt_footer_text: data.receipt_footer_text ?? 'Thank you for dining with us!',
        show_tax_on_receipt: data.show_tax_on_receipt ?? true,
        show_service_charge_on_receipt: data.show_service_charge_on_receipt ?? true,
        allow_multiple_orders_per_table: data.allow_multiple_orders_per_table ?? true,
        auto_close_session_after_payment: data.auto_close_session_after_payment ?? true,
      });
      setOriginalCurrency(data.currency || 'USD');
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

    setSaving(true);
    try {
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
          receipt_header_text: settings.receipt_header_text,
          receipt_footer_text: settings.receipt_footer_text,
          show_tax_on_receipt: settings.show_tax_on_receipt,
          show_service_charge_on_receipt: settings.show_service_charge_on_receipt,
          allow_multiple_orders_per_table: settings.allow_multiple_orders_per_table,
          auto_close_session_after_payment: settings.auto_close_session_after_payment,
        })
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

  const handleRemoveLogo = () => {
    setSettings(prev => prev ? { ...prev, logo_url: null } : null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
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
            <Store className="h-5 w-5 text-primary" />
            <CardTitle>Shop Profile</CardTitle>
          </div>
          <CardDescription>Basic information about your restaurant</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logo */}
          <div className="space-y-2">
            <Label>Restaurant Logo</Label>
            <div className="flex items-center gap-4">
              {settings.logo_url ? (
                <div className="relative">
                  <img 
                    src={settings.logo_url} 
                    alt="Logo" 
                    className="h-20 w-20 rounded-lg object-cover border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={handleRemoveLogo}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="h-20 w-20 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center bg-muted/20">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Uploading...' : settings.logo_url ? 'Change Logo' : 'Upload Logo'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
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
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle>Financial Settings</CardTitle>
          </div>
          <CardDescription>Currency and tax configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select 
              value={pendingCurrencyChange || settings.currency} 
              onValueChange={handleCurrencyChange}
              disabled={hasActiveSessions}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((curr) => (
                  <SelectItem key={curr.value} value={curr.value}>
                    {curr.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasActiveSessions && (
              <p className="text-xs text-muted-foreground">
                Close all active sessions to change currency
              </p>
            )}
          </div>

          {pendingCurrencyChange && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <p className="font-medium mb-2">Warning: Changing currency</p>
                <p className="text-sm mb-3">
                  Changing currency will affect how prices are displayed on receipts and reports. 
                  Existing order data will not be converted.
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
        </CardContent>
      </Card>

      {/* Receipt Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <CardTitle>Receipt Settings</CardTitle>
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
            <Settings2 className="h-5 w-5 text-primary" />
            <CardTitle>Operation Settings</CardTitle>
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

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
