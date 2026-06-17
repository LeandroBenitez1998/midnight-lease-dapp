// LeasePrivateState es el estado privado LOCAL del caller — no se publica ni se comparte.
// En Midnight, cada participante mantiene su propio estado privado en el cliente.
// El contrato Compact accede a este estado a través de los witnesses (parámetros ZK privados).
// callerAddress identifica al usuario que está interactuando con el contrato en este momento.
export type LeasePrivateState = {
  callerAddress: Uint8Array;
};

// WitnessContext modela el entorno privado disponible cuando se ejecutan los witnesses.
// El SDK lo usa para tipar los callbacks de witness — es una interfaz de contrato,
// no un objeto que se instancia en runtime.
type WitnessContext = {
  privateState: LeasePrivateState;
};

// Factory que construye el estado privado inicial del caller.
// El default es Uint8Array vacío — el caller real sobrescribe esto con su dirección.
export const createPrivateState = (
  callerAddress: Uint8Array = new Uint8Array(),
): LeasePrivateState => {
  return {
    callerAddress,
  };
};

// Truco de TypeScript para forzar la verificación de tipos de WitnessContext en tiempo de compilación
// sin instanciar el objeto en runtime. Si WitnessContext tuviera una propiedad con tipo incorrecto,
// el compilador lo detectaría acá. No es lógica de negocio — es una guardia de tipos estática.
void ({} as WitnessContext);

// Exportamos un objeto witnesses vacío porque este contrato no define callbacks witness privados.
// Los circuits de lease.compact no requieren inputs witness en esta versión —
// todos los datos se pasan como argumentos públicos (los hashes y commitments).
// Si en el futuro se agregan circuits que necesiten datos privados del caller,
// se agregan acá como propiedades del objeto con la firma que espera el SDK.
export const witnesses = {};
