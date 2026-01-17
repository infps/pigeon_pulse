"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadWithCrop } from "@/components/image-upload-with-crop";
import { authClient } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Monitor, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Session, set } from "better-auth";

interface UserProfile {
  id: string;
  name: string;
  lastName?: string | null;
  email: string;
  username?: string | null;
  displayUsername?: string | null;
  image?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  address?: string | null;
  postalCode?: string | null;
  phoneNumber?: string | null;
  webAddress?: string | null;
  note?: string | null;
  status: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export default function ProfilePage() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();
    const [sessions, setSessions] = useState<Session[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const [formData, setFormData] = useState({
    name: "",
    lastName: "",
    displayUsername: "",
    country: "",
    state: "",
    city: "",
    address: "",
    postalCode: "",
    phoneNumber: "",
    webAddress: "",
    image: "",
    note: "",
  });

  // Fetch user profile from database
  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user) return;
      
      try {
        setIsLoadingProfile(true);
        const response = await fetch("/api/user/profile");
        
        if (!response.ok) {
          throw new Error("Failed to fetch profile");
        }
        
        const data = await response.json();
        setUserData(data.user);
        
        // Update form data with fetched user data
        setFormData({
          name: data.user.name || "",
          lastName: data.user.lastName || "",
          displayUsername: data.user.displayUsername || "",
          country: data.user.country || "",
          state: data.user.state || "",
          city: data.user.city || "",
          address: data.user.address || "",
          postalCode: data.user.postalCode || "",
          phoneNumber: data.user.phoneNumber || "",
          webAddress: data.user.webAddress || "",
          image: data.user.image || "",
          note: data.user.note || "",
        });
        const {data:sessionData} = await authClient.listSessions();
        setSessions(sessionData);
      } catch (error) {
        toast.error("Failed to load profile data");
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [session?.user]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageChange = (imageUrl: string | null, file?: File | null) => {
    setFormData((prev) => ({ ...prev, image: imageUrl || "" }));
    setImageFile(file || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formDataToSend = new FormData();
      
      // Add all text fields
      Object.entries(formData).forEach(([key, value]) => {
        if (key !== "image" && value) {
          formDataToSend.append(key, value);
        }
      });

      // Add image file if changed
      if (imageFile) {
        formDataToSend.append("image", imageFile);
      }

      const response = await fetch("/api/user/profile", {
        method: "PUT",
        body: formDataToSend,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update profile");
      }

      toast.success("Profile updated successfully");

      // Refresh profile data from database
      const profileResponse = await fetch("/api/user/profile");
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        setUserData(profileData.user);
        setFormData({
          name: profileData.user.name || "",
          lastName: profileData.user.lastName || "",
          displayUsername: profileData.user.displayUsername || "",
          country: profileData.user.country || "",
          state: profileData.user.state || "",
          city: profileData.user.city || "",
          address: profileData.user.address || "",
          postalCode: profileData.user.postalCode || "",
          phoneNumber: profileData.user.phoneNumber || "",
          webAddress: profileData.user.webAddress || "",
          image: profileData.user.image || "",
          note: profileData.user.note || "",
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeSession = async (token: string) => {
    if (!window.confirm("Are you sure you want to revoke this session? The device will be logged out immediately.")) {
      return;
    }

    try {
      await authClient.revokeSession({ token });
      toast.success("Session revoked successfully");
      setSessions((prevSessions) => prevSessions ? prevSessions.filter((s) => s.token !== token) : null);
    } catch (error) {
      toast.error("Failed to revoke session");
    }
  };

  const handleRevokeOtherSessions = async () => {
    if (!window.confirm("Are you sure you want to revoke all other sessions?")) {
      return;
    }

    try {
      await authClient.revokeOtherSessions();
      toast.success("All other sessions revoked successfully");
      setSessions(null);
    } catch (error) {
      toast.error("Failed to revoke other sessions");
    }
  };

  if (sessionLoading || isLoadingProfile) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!session?.user || !userData) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Not Logged In</CardTitle>
            <CardDescription>Please log in to view your profile</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Profile Settings</h1>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile">Profile Information</TabsTrigger>
          <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>
                  Update your profile information and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left side - Form Fields */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Name Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">First Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => handleInputChange("name", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) => handleInputChange("lastName", e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Display Username */}
                    <div className="space-y-2">
                      <Label htmlFor="displayUsername">Display Username</Label>
                      <Input
                        id="displayUsername"
                        value={formData.displayUsername}
                        onChange={(e) => handleInputChange("displayUsername", e.target.value)}
                      />
                    </div>

                    {/* Username (Read-only) */}
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input value={userData.username || ""} disabled />
                      <p className="text-sm text-muted-foreground">
                        Username cannot be changed
                      </p>
                    </div>

                    {/* Contact Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phoneNumber">Phone Number</Label>
                        <Input
                          id="phoneNumber"
                          type="tel"
                          value={formData.phoneNumber}
                          onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="webAddress">Website</Label>
                        <Input
                          id="webAddress"
                          type="url"
                          value={formData.webAddress}
                          onChange={(e) => handleInputChange("webAddress", e.target.value)}
                          placeholder="https://"
                        />
                      </div>
                    </div>

                    {/* Location Information */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Input
                          id="country"
                          value={formData.country}
                          onChange={(e) => handleInputChange("country", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Input
                          id="state"
                          value={formData.state}
                          onChange={(e) => handleInputChange("state", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => handleInputChange("city", e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Address */}
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => handleInputChange("address", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="postalCode">Postal Code</Label>
                      <Input
                        id="postalCode"
                        value={formData.postalCode}
                        onChange={(e) => handleInputChange("postalCode", e.target.value)}
                      />
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label htmlFor="note">Notes</Label>
                      <Textarea
                        id="note"
                        value={formData.note}
                        onChange={(e) => handleInputChange("note", e.target.value)}
                        rows={4}
                        placeholder="Add any additional notes..."
                      />
                    </div>

                    {/* Email (Read-only) */}
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={userData.email} disabled />
                      <p className="text-sm text-muted-foreground">
                        Email cannot be changed from this page
                      </p>
                    </div>

                    {/* Status (Read-only) */}
                    <div className="space-y-2">
                      <Label>Account Status</Label>
                      <Input value={userData.status || ""} disabled />
                      <p className="text-sm text-muted-foreground">
                        Status is managed by administrators
                      </p>
                    </div>

                    {/* Role (Read-only) */}
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Input value={userData.role} disabled />
                      <p className="text-sm text-muted-foreground">
                        Role is managed by administrators
                      </p>
                    </div>
                  </div>

                  {/* Right side - Profile Image */}
                  <div className="lg:col-span-1">
                    <div className="space-y-2 sticky top-6">
                      <Label>Profile Image</Label>
                      <div className="aspect-square w-full max-w-sm mx-auto">
                        <ImageUploadWithCrop
                          aspect={1}
                          value={formData.image}
                          onChange={handleImageChange}
                          placeholder="Upload profile image"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>
                Manage your active sessions across different devices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!sessions ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <>
                  {sessions && sessions.length > 1 && (
                    <Button
                      variant="destructive"
                      onClick={handleRevokeOtherSessions}
                      className="mb-4"
                    >
                      Revoke All Other Sessions
                    </Button>
                  )}

                  {sessions?.map((sessionItem) => {
                    const isCurrentSession = sessionItem.token === session.token;
                    return (
                      <Card key={sessionItem.id} className={isCurrentSession ? "border-primary" : ""}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4">
                              <Monitor className="h-5 w-5 mt-1 text-muted-foreground" />
                              <div className="space-y-1">
                                <p className="font-medium">
                                  {sessionItem.userAgent || "Unknown Device"}
                                  {isCurrentSession && (
                                    <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                                      Current
                                    </span>
                                  )}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  IP: {sessionItem.ipAddress || "Unknown"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Created: {format(new Date(sessionItem.createdAt), "PPpp")}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Expires: {format(new Date(sessionItem.expiresAt), "PPpp")}
                                </p>
                              </div>
                            </div>
                            {!isCurrentSession && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRevokeSession(sessionItem.token)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {(!sessions || sessions.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">
                      No active sessions found
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
