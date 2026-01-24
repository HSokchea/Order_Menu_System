import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ChefHat, Eye, EyeOff } from 'lucide-react';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const clearFieldError = (field: string) => {
    setFormErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateSignInForm = () => {
    const errors: Record<string, string> = {};
    
    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateSignUpForm = () => {
    const errors: Record<string, string> = {};
    
    const trimmedFullName = fullName.trim();
    if (!trimmedFullName) {
      errors.fullName = 'Full name is required';
    } else if (trimmedFullName.length < 2) {
      errors.fullName = 'Full name must be at least 2 characters';
    } else if (trimmedFullName.length > 100) {
      errors.fullName = 'Full name must be less than 100 characters';
    }
    
    if (!restaurantName.trim()) {
      errors.restaurantName = 'Shop name is required';
    }
    
    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateSignInForm()) {
      return;
    }
    
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      // Generic error message to avoid revealing user existence
      setFormErrors({ general: 'Invalid email or password. Please try again.' });
      setLoading(false);
      return;
    }

    // After successful auth, check if user is active and has restaurant
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Check profile status and restaurant association
      const { data: profile } = await supabase
        .from('profiles')
        .select('status, restaurant_id')
        .eq('user_id', user.id)
        .single();

      // If profile exists and is inactive, sign them out
      if (profile && profile.status === 'inactive') {
        await supabase.auth.signOut();
        toast({
          title: "Account Inactive",
          description: "Your account has been deactivated. Please contact your manager.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // If profile exists but has no restaurant_id, this is an orphan account
      // This shouldn't happen with proper flows, but handle gracefully
      if (profile && !profile.restaurant_id) {
        // Check if user is a restaurant owner
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('id')
          .eq('owner_id', user.id)
          .maybeSingle();

        if (!restaurant) {
          // User has no restaurant association - should complete signup
          await supabase.auth.signOut();
          toast({
            title: "Setup Incomplete",
            description: "Your account setup is incomplete. Please sign up again to create your shop.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }
    }

    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateSignUpForm()) {
      return;
    }
    
    const trimmedFullName = fullName.trim();
    
    setLoading(true);

    // ONE-USER-ONE-SHOP: Check if user already exists with a profile (by email)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, restaurant_id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existingProfile) {
      setFormErrors({ email: 'This account already belongs to a shop. Please sign in instead.' });
      setLoading(false);
      return;
    }

    const { data, error } = await signUp(email, password, restaurantName, trimmedFullName);

    if (error) {
      // Handle specific error for user already registered
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes('already registered') || errorMessage.includes('already been registered')) {
        setFormErrors({ email: 'This email is already registered. Please sign in instead.' });
      } else {
        setFormErrors({ general: error.message });
      }
      setLoading(false);
      return;
    }

    // Check if email confirmation is required
    if (data?.user?.identities?.length === 0) {
      // User already exists but hasn't confirmed email
      setFormErrors({ email: 'This email is already registered. Please check your email or sign in.' });
    } else {
      toast({
        title: "Account Created",
        description: "Please check your email to verify your account.",
      });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <ChefHat className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Scanvia</CardTitle>
          <CardDescription>Sign in to manage your shop</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full" onValueChange={() => setFormErrors({})}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                {formErrors.general && (
                  <p className="text-sm text-destructive">{formErrors.general}</p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    placeholder="Enter your email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearFieldError('email');
                      clearFieldError('general');
                    }}
                  />
                  {formErrors.email && (
                    <p className="text-sm text-destructive">{formErrors.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      className='pr-10'
                      placeholder="Enter your password"
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearFieldError('password');
                        clearFieldError('general');
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {formErrors.password && (
                    <p className="text-sm text-destructive">{formErrors.password}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing In..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                {formErrors.general && (
                  <p className="text-sm text-destructive">{formErrors.general}</p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="full-name">Full Name</Label>
                  <Input
                    id="full-name"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      clearFieldError('fullName');
                      clearFieldError('general');
                    }}
                  />
                  {formErrors.fullName && (
                    <p className="text-sm text-destructive">{formErrors.fullName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shop-name">Shop Name</Label>
                  <Input
                    id="shop-name"
                    placeholder="Enter your shop name"
                    value={restaurantName}
                    onChange={(e) => {
                      setRestaurantName(e.target.value);
                      clearFieldError('restaurantName');
                      clearFieldError('general');
                    }}
                  />
                  {formErrors.restaurantName && (
                    <p className="text-sm text-destructive">{formErrors.restaurantName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    placeholder="Enter your email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearFieldError('email');
                      clearFieldError('general');
                    }}
                  />
                  {formErrors.email && (
                    <p className="text-sm text-destructive">{formErrors.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input
                      className='pr-10'
                      placeholder="Enter your password"
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearFieldError('password');
                        clearFieldError('general');
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {formErrors.password && (
                    <p className="text-sm text-destructive">{formErrors.password}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating Account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;