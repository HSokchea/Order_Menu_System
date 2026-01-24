import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ChefHat, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const { signIn, signUp } = useAuth();

  const markFieldTouched = (field: string) => {
    setTouchedFields(prev => ({ ...prev, [field]: true }));
  };

  const shouldShowError = (field: string) => {
    return (touchedFields[field] || submitAttempted) && !!formErrors[field];
  };

  const validateEmail = (value: string): string => {
    if (!value.trim()) {
      return 'Please enter a valid email address';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
      return 'Please enter a valid email address';
    }
    return '';
  };

  const validatePassword = (value: string): string => {
    if (!value) {
      return 'Password is required';
    }
    if (value.length < 6) {
      return 'Password must be at least 6 characters';
    }
    return '';
  };

  const validateFullName = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Full name is required';
    }
    if (trimmed.length < 2) {
      return 'Full name must be at least 2 characters';
    }
    if (trimmed.length > 100) {
      return 'Full name must be less than 100 characters';
    }
    return '';
  };

  const validateRestaurantName = (value: string): string => {
    if (!value.trim()) {
      return 'Shop name is required';
    }
    return '';
  };

  const validateField = (field: string, value: string) => {
    let error = '';
    switch (field) {
      case 'email':
        error = validateEmail(value);
        break;
      case 'password':
        error = validatePassword(value);
        break;
      case 'fullName':
        error = validateFullName(value);
        break;
      case 'restaurantName':
        error = validateRestaurantName(value);
        break;
    }
    setFormErrors(prev => ({ ...prev, [field]: error }));
    return error;
  };

  const handleBlur = (field: string, value: string) => {
    markFieldTouched(field);
    validateField(field, value);
  };

  const validateSignInForm = (): boolean => {
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    
    setFormErrors({
      email: emailError,
      password: passwordError,
    });
    
    return !emailError && !passwordError;
  };

  const validateSignUpForm = (): boolean => {
    const fullNameError = validateFullName(fullName);
    const restaurantNameError = validateRestaurantName(restaurantName);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    
    setFormErrors({
      fullName: fullNameError,
      restaurantName: restaurantNameError,
      email: emailError,
      password: passwordError,
    });
    
    return !fullNameError && !restaurantNameError && !emailError && !passwordError;
  };

  const resetFormState = () => {
    setFormErrors({});
    setTouchedFields({});
    setSubmitAttempted(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    
    if (!validateSignInForm()) {
      return;
    }
    
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setFormErrors(prev => ({ ...prev, general: 'Invalid email or password. Please try again.' }));
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('status, restaurant_id')
        .eq('user_id', user.id)
        .single();

      if (profile && profile.status === 'inactive') {
        await supabase.auth.signOut();
        toast.error("Your account has been deactivated. Please contact your manager.");
        setLoading(false);
        return;
      }

      if (profile && !profile.restaurant_id) {
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('id')
          .eq('owner_id', user.id)
          .maybeSingle();

        if (!restaurant) {
          await supabase.auth.signOut();
          toast.error("Your account setup is incomplete. Please sign up again to create your shop.");
          setLoading(false);
          return;
        }
      }
    }

    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    
    if (!validateSignUpForm()) {
      return;
    }
    
    const trimmedFullName = fullName.trim();
    
    setLoading(true);

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, restaurant_id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existingProfile) {
      setFormErrors(prev => ({ ...prev, email: 'This account already belongs to a shop. Please sign in instead.' }));
      setLoading(false);
      return;
    }

    const { data, error } = await signUp(email, password, restaurantName, trimmedFullName);

    if (error) {
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes('already registered') || errorMessage.includes('already been registered')) {
        setFormErrors(prev => ({ ...prev, email: 'This email is already registered. Please sign in instead.' }));
      } else {
        setFormErrors(prev => ({ ...prev, general: error.message }));
      }
      setLoading(false);
      return;
    }

    if (data?.user?.identities?.length === 0) {
      setFormErrors(prev => ({ ...prev, email: 'This email is already registered. Please check your email or sign in.' }));
    } else {
      toast.success("Please check your email to verify your account.");
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
          <Tabs defaultValue="signin" className="w-full" onValueChange={resetFormState}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} noValidate className="space-y-4">
                {formErrors.general && (
                  <p className="text-sm text-destructive" role="alert">{formErrors.general}</p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    placeholder="you@restaurant.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => handleBlur('email', email)}
                    className={cn(shouldShowError('email') && 'border-destructive focus-visible:ring-destructive')}
                    aria-invalid={shouldShowError('email')}
                    aria-describedby={shouldShowError('email') ? 'email-error' : undefined}
                  />
                  {shouldShowError('email') && (
                    <p id="email-error" className="text-sm text-destructive" role="alert">
                      {formErrors.email}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      placeholder="Enter your password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => handleBlur('password', password)}
                      className={cn('pr-10', shouldShowError('password') && 'border-destructive focus-visible:ring-destructive')}
                      aria-invalid={shouldShowError('password')}
                      aria-describedby={shouldShowError('password') ? 'password-error' : undefined}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {shouldShowError('password') && (
                    <p id="password-error" className="text-sm text-destructive" role="alert">
                      {formErrors.password}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing In..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} noValidate className="space-y-4">
                {formErrors.general && (
                  <p className="text-sm text-destructive" role="alert">{formErrors.general}</p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="full-name">Full Name</Label>
                  <Input
                    id="full-name"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    onBlur={() => handleBlur('fullName', fullName)}
                    className={cn(shouldShowError('fullName') && 'border-destructive focus-visible:ring-destructive')}
                    aria-invalid={shouldShowError('fullName')}
                    aria-describedby={shouldShowError('fullName') ? 'fullname-error' : undefined}
                  />
                  {shouldShowError('fullName') && (
                    <p id="fullname-error" className="text-sm text-destructive" role="alert">
                      {formErrors.fullName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shop-name">Shop Name</Label>
                  <Input
                    id="shop-name"
                    placeholder="Enter your shop name"
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    onBlur={() => handleBlur('restaurantName', restaurantName)}
                    className={cn(shouldShowError('restaurantName') && 'border-destructive focus-visible:ring-destructive')}
                    aria-invalid={shouldShowError('restaurantName')}
                    aria-describedby={shouldShowError('restaurantName') ? 'shopname-error' : undefined}
                  />
                  {shouldShowError('restaurantName') && (
                    <p id="shopname-error" className="text-sm text-destructive" role="alert">
                      {formErrors.restaurantName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    placeholder="you@restaurant.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => handleBlur('email', email)}
                    className={cn(shouldShowError('email') && 'border-destructive focus-visible:ring-destructive')}
                    aria-invalid={shouldShowError('email')}
                    aria-describedby={shouldShowError('email') ? 'signup-email-error' : undefined}
                  />
                  {shouldShowError('email') && (
                    <p id="signup-email-error" className="text-sm text-destructive" role="alert">
                      {formErrors.email}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      placeholder="Enter your password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => handleBlur('password', password)}
                      className={cn('pr-10', shouldShowError('password') && 'border-destructive focus-visible:ring-destructive')}
                      aria-invalid={shouldShowError('password')}
                      aria-describedby={shouldShowError('password') ? 'signup-password-error' : undefined}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {shouldShowError('password') && (
                    <p id="signup-password-error" className="text-sm text-destructive" role="alert">
                      {formErrors.password}
                    </p>
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