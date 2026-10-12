export function ExerciseSubmission({ submission }: { submission: string }) {
  return (
    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-sans text-sm leading-6">
      {submission}
    </pre>
  );
}
