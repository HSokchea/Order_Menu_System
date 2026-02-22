import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Store, Loader2, Upload, X, ImageIcon } from 'lucide-react';
const BUSINESS_TYPES = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'cafe', label: 'Café' },
  { value: 'tea_shop', label: 'Tea Shop' },
  { value: 'bar', label: 'Bar' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'food_truck', label: 'Food Truck' },
];

const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'KHR', label: 'KHR (៛)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'THB', label: 'THB (฿)' },
  { value: 'VND', label: 'VND (₫)' },
];

const TIMEZONES = [
  { value: 'Asia/Phnom_Penh', label: 'Phnom Penh (GMT+7)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (GMT+7)' },
  { value: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh (GMT+7)' },
  { value: 'Asia/Singapore', label: 'Singapore (GMT+8)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (GMT+9)' },
  { value: 'Europe/London', label: 'London (GMT+0)' },
  { value: 'America/New_York', label: 'New York (GMT-5)' },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    country: '',
    city: '',
    timezone: 'Asia/Phnom_Penh',
    currency: 'USD',
    business_type: 'restaurant',
    cuisine_type: '',
    default_tax_percentage: '0',
    service_charge_percentage: '0',
    address: '',
    vat_tin: '',
    default_order_type: 'dine_in',
  });

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      // Wait for auth to complete
      if (authLoading) return;
      
      if (!user) {
        navigate('/auth', { replace: true });
        return;
      }

      console.log('[Onboarding] Checking if user is restaurant owner:', user.id);

      // CRITICAL: Check if user is the restaurant OWNER by checking restaurants.owner_id
      // This is the ONLY way to determine ownership - NOT profiles.role or Supabase Auth role
      const { data: restaurant, error } = await supabase
        .from('restaurants')
        .select('id, name, is_onboarded')
        .eq('owner_id', user.id)
        .single();

      // If error or no restaurant found where user is owner, they're STAFF - redirect to dashboard
      if (error || !restaurant) {
        console.log('[Onboarding] User is NOT a restaurant owner (staff user), redirecting to /admin');
        navigate('/admin', { replace: true });
        return;
      }

      console.log('[Onboarding] User IS restaurant owner, onboarded:', restaurant.is_onboarded);

      // Owner has already completed onboarding - redirect to admin
      if (restaurant.is_onboarded) {
        navigate('/admin', { replace: true });
        return;
      }

      // Owner with un-onboarded restaurant - show onboarding form
      setRestaurantId(restaurant.id);
      if (restaurant.name) {
        setFormData(prev => ({ ...prev, name: restaurant.name }));
      }
      setChecking(false);
    };

    checkOnboardingStatus();
  }, [user, authLoading, navigate]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const uploadLogo = async (file: File) => {
    if (!restaurantId) return;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `logos/${restaurantId}/${Date.now()}.${fileExt}`;
    
    setUploading(true);
    
    try {
      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('menu-images')
        .getPublicUrl(fileName);

      setLogoUrl(data.publicUrl);
      toast.success("Logo uploaded successfully");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = () => {
    setLogoUrl(null);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadLogo(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!restaurantId) {
      toast.error("Restaurant not found. Please try signing up again.");
      return;
    }

    if (!formData.name.trim()) {
      toast.error("Please enter your restaurant name.");
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from('restaurants')
      .update({
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        country: formData.country.trim() || null,
        city: formData.city.trim() || null,
        timezone: formData.timezone,
        currency: formData.currency,
        business_type: formData.business_type,
        cuisine_type: formData.cuisine_type.trim() || null,
        default_tax_percentage: parseFloat(formData.default_tax_percentage) || 0,
        service_charge_percentage: parseFloat(formData.service_charge_percentage) || 0,
        address: formData.address.trim() || null,
        logo_url: logoUrl,
        vat_tin: formData.vat_tin.trim() || null,
        default_order_type: formData.default_order_type,
        is_onboarded: true,
      })
      .eq('id', restaurantId);

    if (error) {
      console.error('Error updating restaurant:', error);
      toast.error("Failed to save your information. Please try again.");
      setLoading(false);
      return;
    }

    toast.success("Your restaurant profile has been set up successfully.");

    navigate('/admin');
  };

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Store className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Set Up Your Restaurant</CardTitle>
          <CardDescription>
            Tell us about your business to personalize your experience
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Shop Logo */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Shop Logo</h3>
              <div className="flex flex-col items-center gap-4">
                {logoUrl ? (
                  <div className="relative group">
                    <img
                      src={logoUrl}
                      alt="Shop logo"
                      className="w-32 h-32 object-cover rounded-full border-4 border-primary/20"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute -top-2 -right-2 h-8 w-8 rounded-full p-0"
                      onClick={removeLogo}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="w-32 h-32 border-2 border-dashed border-border rounded-full flex flex-col items-center justify-center bg-muted/20">
                    <ImageIcon className="h-8 w-8 text-muted-foreground mb-1" />
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !restaurantId}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Uploading...' : logoUrl ? 'Change Logo' : 'Upload Logo'}
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

            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Restaurant Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="My Restaurant"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="+855 12 345 678"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business_type">Business Type</Label>
                  <Select
                    value={formData.business_type}
                    onValueChange={(value) => handleChange('business_type', value)}
                  >
                    <SelectTrigger id="business_type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cuisine_type">Cuisine Type</Label>
                  <Input
                    id="cuisine_type"
                    value={formData.cuisine_type}
                    onChange={(e) => handleChange('cuisine_type', e.target.value)}
                    placeholder="e.g., Khmer, Thai, Italian"
                  />
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Location</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => handleChange('country', e.target.value)}
                    placeholder="Cambodia"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    placeholder="Phnom Penh"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={formData.timezone}
                    onValueChange={(value) => handleChange('timezone', value)}
                  >
                    <SelectTrigger id="timezone">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    placeholder="Street address"
                  />
                </div>
              </div>
            </div>

            {/* Financial */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Financial Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => handleChange('currency', value)}
                  >
                    <SelectTrigger id="currency">
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vat_tin">VAT TIN (Optional)</Label>
                  <Input
                    id="vat_tin"
                    value={formData.vat_tin}
                    onChange={(e) => handleChange('vat_tin', e.target.value)}
                    placeholder="e.g., K001-12345678"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="default_tax_percentage">Tax %</Label>
                  <Input
                    id="default_tax_percentage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.default_tax_percentage}
                    onChange={(e) => handleChange('default_tax_percentage', e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service_charge_percentage">Service Charge %</Label>
                  <Input
                    id="service_charge_percentage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.service_charge_percentage}
                    onChange={(e) => handleChange('service_charge_percentage', e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Operation Defaults */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Operation Defaults</h3>
              <div className="space-y-2">
                <Label htmlFor="default_order_type">Default Order Type</Label>
                <Select
                  value={formData.default_order_type}
                  onValueChange={(value) => handleChange('default_order_type', value)}
                >
                  <SelectTrigger id="default_order_type">
                    <SelectValue placeholder="Select order type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dine_in">Dine In</SelectItem>
                    <SelectItem value="takeaway">Takeaway</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Complete Setup"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
