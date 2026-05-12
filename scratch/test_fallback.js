
console.log('Testing nullish coalescing with empty string:');
const emptyStr = "";
console.log('"" ?? "fallback" ->', emptyStr ?? "fallback");
console.log('"" || "fallback" ->', emptyStr || "fallback");

console.log('\nTesting with undefined:');
const undef = undefined;
console.log('undefined ?? "fallback" ->', undef ?? "fallback");
console.log('undefined || "fallback" ->', undef || "fallback");
