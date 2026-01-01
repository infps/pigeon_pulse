"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

const signupSchema = z.object({
  firstName: z
    .string()
    .min(2, "First name must be at least 2 characters.")
    .max(50, "First name must be at most 50 characters."),
  lastName: z
    .string()
    .min(2, "Last name must be at least 2 characters.")
    .max(50, "Last name must be at most 50 characters."),
  email: z.string().email("Please enter a valid email address."),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters.")
    .max(20, "Username must be at most 20 characters.")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores."
    ),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(100, "Password must be at most 100 characters.")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
    .regex(/[0-9]/, "Password must contain at least one number."),
});

export default function SignupPage() {
  const router = useRouter();
  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      username: "",
      password: "",
    },
  });

  async function onSubmit(data: z.infer<typeof signupSchema>) {
    try {
      const { data: userNameResponse, error } =
        await authClient.isUsernameAvailable({
          username: data.username,
        });
      if (error) {
        toast.error("Error checking username availability.");
        return;
      }
      if (!userNameResponse?.available) {
        form.setError("username", {
          type: "custom",
          message: "Username is already taken.",
        });
        return;
      }

      const { data: signupData, error: signupError } =
        await authClient.signUp.email({
          name: data.firstName + " " + data.lastName,
          email: data.email,
          username: data.username,
          password: data.password,
        });
      if (signupError) {
        toast.error("Error creating account: " + signupError.message);
        return;
      }
      toast.success("Account created successfully!");
      form.reset();
      router.push("/");
    }catch (error) {
      toast.error("An unexpected error occurred.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center py-12">
      <div className="w-full max-w-md space-y-8 rounded-lg border p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Create an Account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Fill in the details below to get started
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Controller
              name="firstName"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>First Name</FieldLabel>
                  <Input
                    disabled={form.formState.isSubmitting}
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    placeholder="John"
                    autoComplete="given-name"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="lastName"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Last Name</FieldLabel>
                  <Input
                    disabled={form.formState.isSubmitting}
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    placeholder="Doe"
                    autoComplete="family-name"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>

          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                <Input
                  {...field}
                  disabled={form.formState.isSubmitting}
                  id={field.name}
                  type="email"
                  aria-invalid={fieldState.invalid}
                  placeholder="john.doe@example.com"
                  autoComplete="email"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="username"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                <Input
                  {...field}
                  disabled={form.formState.isSubmitting}
                  id={field.name}
                  aria-invalid={fieldState.invalid}
                  placeholder="johndoe"
                  autoComplete="username"
                />
                <FieldDescription>
                  Choose a unique username for your account.
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  disabled={form.formState.isSubmitting}
                  type="password"
                  aria-invalid={fieldState.invalid}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                />
                <FieldDescription>
                  Must be at least 8 characters with uppercase, lowercase, and
                  numbers.
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              "Create Account"
            )}
          </Button>

          <div className="text-center text-sm">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
