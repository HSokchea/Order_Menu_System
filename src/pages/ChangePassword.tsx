import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { KeyRound, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

interface ChangePasswordProps {
  restaurantName?: string;
  onComplete?: () => void;
}

const ChangePassword = ({ restaurantName, onComplete }: ChangePasswordProps) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Password validation
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;
  const isValidPassword = hasMinLength && hasUppercase && hasLowercase && hasNumber && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidPassword) {
      toast.error("Please ensure your password meets all requirements.");
      return;
    }

    setLoading(true);

    try {
      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      // Update profile to clear must_change_password flag
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      toast.success("Your password has been changed successfully.");

      if (onComplete) {
        onComplete();
      } else {
        navigate('/admin', { replace: true });
      }
    } catch (error: any) {
      console.error('Password change error:', error);
      toast.error(error.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  const ValidationCheck = ({ valid, text }: { valid: boolean; text: string }) => (
    <div className={`flex items-center gap-2 text-sm ${valid ? 'text-green-600' : 'text-muted-foreground'}`}>
      <CheckCircle2 className={`h-4 w-4 ${valid ? 'text-green-600' : 'text-muted-foreground/50'}`} />
      {text}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <KeyRound className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Change Your Password</CardTitle>
          <CardDescription>
            {restaurantName ? (
              <>Welcome to <span className="font-semibold text-foreground">{restaurantName}</span>! </>
            ) : null}
            Please set a new password to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  className='pr-10'
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Input
                  className='pr-10'
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium text-muted-foreground mb-2">Password requirements:</p>
              <ValidationCheck valid={hasMinLength} text="At least 8 characters" />
              <ValidationCheck valid={hasUppercase} text="One uppercase letter" />
              <ValidationCheck valid={hasLowercase} text="One lowercase letter" />
              <ValidationCheck valid={hasNumber} text="One number" />
              <ValidationCheck valid={passwordsMatch} text="Passwords match" />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || !isValidPassword}
            >
              {loading ? "Updating..." : "Set New Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChangePassword;
