import { z } from "zod";
import { isCountry } from "./countries";
import { UNIT_VALUES, STATUS_VALUES, PACKAGE_UNITS, CONTENT_UNITS, type Unit } from "./units";
import { COMMODITIES, VARIETIES, GRADES, COMMODITY_VARIETIES, type Commodity, type Variety } from "./commodities";
import { ExactDecimal } from "./decimal";
const country = z.string().refine(isCountry, "Select a valid country.");

export const PRODUCT_CATEGORIES = [
  "Animal Products",
  "Beans",
  "Cereals",
  "Fruits",
  "Vegetables",
  "Seeds & Nuts",
  "Roots & Tubers",
  "Other",
] as const;

export const registrationSchema = z
  .object({
    country,
    name: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters.")
      .max(100, "Full name must be 100 characters or fewer."),

    phone: z
      .string()
      .trim()
      .min(7, "Please enter a valid phone number.")
      .max(30, "Phone number must be 30 characters or fewer."),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Please enter a valid email address.")
      .max(254, "Email address is too long."),

    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .refine(value => new TextEncoder().encode(value).length <= 72, "Password must be 72 bytes or fewer."),

    confirmPassword: z
      .string()
      .min(1, "Please confirm your password."),

    location: z
      .string()
      .trim()
      .min(2, "Please enter your location.")
      .max(120, "Location must be 120 characters or fewer."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address.")
    .max(254, "Email address is too long."),

  password: z
    .string()
    .min(1, "Password is required."),
});

const quantitySchema = z.string().trim().regex(/^\d{1,9}(\.\d{1,3})?$/, "Enter a quantity with up to 9 whole digits and 3 decimal places.").refine(value => Number(value) > 0, "Quantity must be greater than 0.");
export const listingStatusSchema = z.enum(STATUS_VALUES, { error: "Choose a valid listing status." });
const metadata = {
  commodity: z.union([z.enum(COMMODITIES), z.literal("")]).optional(),
  variety: z.union([z.enum(VARIETIES), z.literal("")]).optional(),
  grade: z.union([z.enum(GRADES), z.literal("")]).optional(),
  packageQuantity: z.union([quantitySchema, z.literal("")]).optional(),
  packageUnit: z.union([z.enum(CONTENT_UNITS), z.literal("")]).optional(),
};
function metadataIssues(data: { commodity?: Commodity | ""; variety?: Variety | ""; grade?: string; quantity?: string; unit?: Unit | ""; packageQuantity?: string; packageUnit?: string }, ctx: z.RefinementCtx) {
  if ((data.variety || data.grade) && !data.commodity) ctx.addIssue({ code: "custom", path: ["commodity"], message: "Choose a commodity before adding variety or grade." });
  if (data.commodity && data.variety && !COMMODITY_VARIETIES[data.commodity].includes(data.variety)) ctx.addIssue({ code: "custom", path: ["variety"], message: "Choose a variety for the selected commodity." });
  if (Boolean(data.packageQuantity) !== Boolean(data.packageUnit)) ctx.addIssue({ code: "custom", path: ["packageQuantity"], message: "Enter both package quantity and contents unit." });
  if ((data.packageQuantity || data.packageUnit) && (!data.unit || !PACKAGE_UNITS.includes(data.unit) || !data.quantity)) ctx.addIssue({ code: "custom", path: ["unit"], message: "Package contents require a package listing unit and quantity." });
}
const productFields = z.object({
  ...metadata,
  quantity: quantitySchema,
  unit: z.enum(UNIT_VALUES, { error: "Choose a standardized unit." }),
  status: listingStatusSchema.default("ACTIVE"),
  country,
  item: z
    .string()
    .trim()
      .min(2, "Product name must be at least 2 characters.")
      .max(120, "Product name must be 120 characters or fewer."),

  category: z
    .string()
    .trim()
      .refine(
        (value) => PRODUCT_CATEGORIES.some((category) => category === value),
        "Please select a valid category."
      ),

  location: z
    .string()
    .trim()
      .min(2, "Please enter a location.")
      .max(120, "Location must be 120 characters or fewer."),

  price: z.preprocess(value => typeof value === "number" ? String(value) : value, z.string().trim().regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter a price with at most 2 decimal places.").pipe(z.string().refine(value => new ExactDecimal(value).gt(0) && new ExactDecimal(value).lte("9999999999.99"), "Price must be positive and no more than 9,999,999,999.99."))),

  description: z
    .string()
    .trim()
      .min(5, "Description must be at least 5 characters.")
      .max(2_000, "Description must be 2,000 characters or fewer."),
});
export const productSchema = productFields.superRefine(metadataIssues);

// Legacy listings may retain missing values, but cannot save an incomplete pair.
export const editProductSchema = productFields.extend({
  quantity: z.union([quantitySchema, z.literal("")]).optional(),
  unit: z.union([z.enum(UNIT_VALUES), z.literal("")]).optional(),
  status: listingStatusSchema.optional(),
}).refine(data => Boolean(data.quantity) === Boolean(data.unit), { message: "Enter both quantity and unit.", path: ["quantity"] }).superRefine(metadataIssues);

export const profileSchema = z.object({
  country,
  name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters.")
    .max(100, "Full name must be 100 characters or fewer."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address.")
    .max(254, "Email address is too long."),
  phone: z
    .string()
    .trim()
    .min(7, "Please enter a valid phone number.")
    .max(30, "Phone number must be 30 characters or fewer."),
  location: z
    .string()
    .trim()
    .min(2, "Please enter your location.")
    .max(120, "Location must be 120 characters or fewer."),
});
