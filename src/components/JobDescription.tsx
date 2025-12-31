
import { Card } from "@/components/ui/card";

interface JobDescriptionProps {
  title: string;
  skills: string[];
  experience?: string;
  responsibilities?: string[];
}

const JobDescription = ({ title, skills, experience, responsibilities }: JobDescriptionProps) => {
  return (
    <Card className="p-6">
      <h2 className="text-2xl font-semibold mb-4">{title}</h2>
      
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Required Skills</h3>
          <ul className="list-disc pl-5">
            {skills.map((skill, index) => (
              <li key={index}>{skill}</li>
            ))}
          </ul>
        </div>

        {experience && (
          <div>
            <h3 className="text-lg font-semibold mb-2">Experience Required</h3>
            <p>{experience}</p>
          </div>
        )}

        {responsibilities && responsibilities.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-2">Key Responsibilities</h3>
            <ul className="list-disc pl-5">
              {responsibilities.map((responsibility, index) => (
                <li key={index}>{responsibility}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
};

export default JobDescription;
