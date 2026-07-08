export type BranchInput = {
  name: string;
  googlePlaceId: string;
};

export type BranchErrors = Partial<Record<keyof BranchInput, string>>;

/** Validación pura del formulario de sucursal: nombre y place_id requeridos, place_id único por org. */
export function validateBranch(
  input: BranchInput,
  existingPlaceIds: string[],
): BranchErrors {
  const errors: BranchErrors = {};

  if (!input.name.trim()) {
    errors.name = "El nombre es obligatorio.";
  }

  if (!input.googlePlaceId.trim()) {
    errors.googlePlaceId = "El Google Place ID es obligatorio.";
  } else if (existingPlaceIds.includes(input.googlePlaceId.trim())) {
    errors.googlePlaceId = "Ya existe una sucursal con ese Place ID en esta organización.";
  }

  return errors;
}
