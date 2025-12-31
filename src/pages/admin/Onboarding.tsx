import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ChefHat, Store, Loader2 } from 'lucide-react';

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
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  
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
  });

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user) {
        if (!authLoading) {
          navigate('/auth');
        }
        return;
      }

      const { data: restaurant, error } = await supabase
        .from('restaurants')
        .select('id, name, is_onboarded')
        .eq('owner_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching restaurant:', error);
        setChecking(false);
        return;
      }

      if (restaurant?.is_onboarded) {
        navigate('/admin');
        return;
      }

      setRestaurantId(restaurant?.id || null);
      if (restaurant?.name) {
        setFormData(prev => ({ ...prev, name: restaurant.name }));
      }
      setChecking(false);
    };

    checkOnboardingStatus();
  }, [user, authLoading, navigate]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!restaurantId) {
      toast({
        title: "Error",
        description: "Restaurant not found. Please try signing up again.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.name.trim()) {
      toast({
        title: "Required Field",
        description: "Please enter your restaurant name.",
        variant: "destructive",
      });
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
        is_onboarded: true,
      })
      .eq('id', restaurantId);

    if (error) {
      console.error('Error updating restaurant:', error);
      toast({
        title: "Error",
        description: "Failed to save your information. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    toast({
      title: "Welcome!",
      description: "Your restaurant profile has been set up successfully.",
    });

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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
